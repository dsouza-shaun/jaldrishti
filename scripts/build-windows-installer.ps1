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

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "node.exe was not found on the build machine." }
Copy-Item -LiteralPath $node.Source -Destination (Join-Path $runtime "node.exe") -Force

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

const port = process.env.PORT || "3000";
const env = { ...process.env, PORT: port, HOSTNAME: "127.0.0.1", DATABASE_URL: `file:${db.replace(/\\/g, "/")}` };
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
Set-Content -LiteralPath (Join-Path $stage "launch.cjs") -Value $launcher -Encoding utf8

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
Set-Content -LiteralPath $issPath -Value $iss -Encoding utf8
& $iscc.Source $issPath
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed to create the installer." }

Write-Host "Installer created: $(Join-Path $output 'JalDrishti-Setup.exe')"
