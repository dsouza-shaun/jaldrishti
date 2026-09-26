$ErrorActionPreference = "Stop"

if (-not $IsWindows -and $env:OS -ne "Windows_NT") {
  throw "Build the Windows installer from Windows PowerShell."
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stage = Join-Path $repo ".release\windows\stage"
$app = Join-Path $stage "app"
$database = Join-Path $stage "database"
$runtime = Join-Path $stage "runtime"
$output = Join-Path $repo ".release\windows\dist"
$standalone = Join-Path $repo ".next\standalone"
$prisma = Join-Path $repo "node_modules\.bin\prisma.cmd"

$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repo ".release\windows"))
$stageFull = [System.IO.Path]::GetFullPath($stage)
if (-not $stageFull.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean a staging directory outside .release\windows."
}

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
  $standardIscc = Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"
  if (Test-Path $standardIscc) { $iscc = Get-Item $standardIscc }
}
if (-not $iscc) { throw "Inno Setup 6 is required on the build machine (ISCC.exe was not found)." }
if (-not (Test-Path $prisma)) { throw "Dependencies are missing. Run npm install first." }

npm run build
if ($LASTEXITCODE -ne 0) { throw "Next.js build failed." }
if (-not (Test-Path (Join-Path $standalone "server.js"))) { throw "Next.js standalone output was not created." }

if (Test-Path $stageFull) { Remove-Item -LiteralPath $stageFull -Recurse -Force }
New-Item -ItemType Directory -Force -Path $app, $database, $runtime, $output | Out-Null
Get-ChildItem -LiteralPath $standalone -Force | Copy-Item -Destination $app -Recurse -Force

# Bake the runtime configuration into the staged app.
#
# `npm run build` triggers scripts/clean-standalone.mjs, which deletes every
# .env file from the standalone output. That is right for a web deploy, where
# the platform injects configuration, and wrong for this desktop build, whose
# launcher runs on a machine with no environment variables at all. Without this
# step the installed app silently ships without its Groq key and its Nominatim
# contact string, and two panels quietly stop working.
#
# Load .env first so a plain `npm run build`-and-package workflow picks up the
# developer's local values, then let real environment variables win over it.
$appEnv = Join-Path $repo ".env"
if (Test-Path -LiteralPath $appEnv) {
  Write-Host "Loading configuration from $appEnv"
  Get-Content -LiteralPath $appEnv | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $separator = $line.IndexOf("=")
    if ($separator -le 0) { return }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim().Trim('"').Trim("'")
    # Never clobber a variable the operator set explicitly for this build.
    if ($name -and -not [Environment]::GetEnvironmentVariable($name)) {
      [Environment]::SetEnvironmentVariable($name, $value)
    }
  }
}

Write-Host "Baking runtime configuration into the installer"
& node (Join-Path $repo "scripts\write-runtime-config.mjs") --output (Join-Path $app "runtime-config.json")
if ($LASTEXITCODE -ne 0) { throw "Could not bake the runtime configuration. See the messages above." }

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "node.exe was not found on the build machine." }
Copy-Item -LiteralPath $node.Source -Destination (Join-Path $runtime "node.exe") -Force

# Write staged text files as UTF-8 *without* a BOM. Windows PowerShell's
# `-Encoding utf8` emits one, which JSON.parse rejects outright and ISCC.exe
# handles inconsistently.
function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$templateDb = Join-Path $database "custom.db"
$previousDatabaseUrl = $env:DATABASE_URL
try {
  $env:DATABASE_URL = "file:$($templateDb.Replace('\', '/'))"
  & $prisma db push --schema (Join-Path $repo "prisma\schema.prisma") --skip-generate
  if ($LASTEXITCODE -ne 0) { throw "Could not create the SQLite database template." }
} finally {
  $env:DATABASE_URL = $previousDatabaseUrl
}

$launcher = @'
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = __dirname;
const app = path.join(root, "app");
const data = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "JalDrishti");
const db = path.join(data, "custom.db");
fs.mkdirSync(data, { recursive: true });
if (!fs.existsSync(db)) fs.copyFileSync(path.join(root, "database", "custom.db"), db);

// Build-time credentials baked in by scripts/write-runtime-config.mjs.
// The `postbuild` step strips .env files from the standalone output, so this
// file is the only channel by which a desktop install receives its
// configuration. Anything already present in the environment wins, which lets
// an administrator override a baked value without rebuilding.
function loadBakedConfig() {
  const file = path.join(app, "runtime-config.json");
  try {
    // Strip a UTF-8 BOM before parsing. Windows PowerShell 5.1's
    // `-Encoding utf8` writes one, and JSON.parse rejects a leading BOM
    // outright, which would turn a working install into a hard failure.
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const keys = parsed && typeof parsed.keys === "object" && parsed.keys ? parsed.keys : {};
    const merged = {};
    for (const [name, value] of Object.entries(keys)) {
      if (typeof value === "string" && value.trim() !== "") merged[name] = value.trim();
    }
    return merged;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.warn("JalDrishti: no runtime-config.json found; optional live features are disabled.");
      return {};
    }
    console.error("JalDrishti: runtime-config.json could not be read:", error.message);
    return {};
  }
}

const port = process.env.PORT || "3000";
const baked = loadBakedConfig();
const env = { ...baked, ...process.env, PORT: port, HOSTNAME: "127.0.0.1", DATABASE_URL: `file:${db.replace(/\\/g, "/")}` };
// process.env is spread last, but a variable that exists yet is empty would
// still shadow a baked value. Drop those so an unset shell variable cannot
// blank out a shipped key.
for (const name of Object.keys(baked)) {
  if (env[name] === "" || env[name] === undefined) delete env[name];
}
const server = spawn(process.execPath, [path.join(app, "server.js")], { cwd: app, env, stdio: "inherit" });
server.on("error", (error) => { console.error("JalDrishti could not start:", error); process.exitCode = 1; });

let attempts = 0;
const poll = setInterval(async () => {
  attempts += 1;
  try {
    const response = await fetch(`http://127.0.0.1:${port}`);
    if (response.ok) {
      clearInterval(poll);
      spawn("cmd.exe", ["/d", "/s", "/c", `start "" "http://127.0.0.1:${port}"`], { windowsHide: true, stdio: "ignore" }).unref();
    }
  } catch { /* Wait for the local server to finish starting. */ }
  if (attempts >= 60) clearInterval(poll);
}, 1000);

server.on("exit", (code) => { clearInterval(poll); process.exitCode = code ?? 0; });
'@
Write-Utf8NoBom (Join-Path $stage "launch.cjs") $launcher

$stageForIss = $stage.Replace('\', '/')
$outputForIss = $output.Replace('\', '/')
$iss = @"
#define StageDir "$stageForIss"
#define OutputDir "$outputForIss"

[Setup]
AppId={{8C7B13B6-987A-4B25-A5D9-0C5D37A12175}
AppName=JalDrishti
AppVersion=0.2.1
DefaultDirName={localappdata}\Programs\JalDrishti
DefaultGroupName=JalDrishti
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=JalDrishti-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\runtime\node.exe

[Files]
Source: "{#StageDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "{#StageDir}\database\custom.db"; DestDir: "{app}\database"; Flags: ignoreversion
Source: "{#StageDir}\launch.cjs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\JalDrishti"; Filename: "{app}\runtime\node.exe"; Parameters: """{app}\launch.cjs"""; WorkingDir: "{app}"
Name: "{autodesktop}\JalDrishti"; Filename: "{app}\runtime\node.exe"; Parameters: """{app}\launch.cjs"""; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Run]
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\launch.cjs"""; WorkingDir: "{app}"; Description: "Launch JalDrishti"; Flags: postinstall nowait skipifsilent
"@
$issPath = Join-Path $stage "JalDrishti.iss"
Write-Utf8NoBom $issPath $iss
& $iscc.Source $issPath
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed to create the installer." }

Write-Host "Installer created: $(Join-Path $output 'JalDrishti-Setup.exe')"
