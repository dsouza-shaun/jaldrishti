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

# ---------------------------------------------------------------------------
# Locate the Inno Setup compiler.
#
# Version-agnostic on purpose. Hardcoding "Inno Setup 6\ISCC.exe" breaks the
# moment the build machine moves to 7.x, and Inno Setup installs to a
# directory named after its major version, so the path really does change
# between releases.
#
# Search order:
#   1. ISCC.exe already on PATH
#   2. Every "Inno Setup *" directory under the known install roots, highest
#      major version first, so a 7.x install wins over a stale 6.x one
#   3. The Uninstall registry key, for per-user or relocated installs
#
# Returns a plain path string rather than a CommandInfo/FileInfo: the previous
# version called `.Source` on the result, which only exists on a CommandInfo,
# so the directory-fallback branch would have invoked a null path.
# ---------------------------------------------------------------------------
function Find-InnoCompiler {
  $roots = @(
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    $env:LOCALAPPDATA,
    (Join-Path $env:USERPROFILE "AppData\Local\Programs")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  $candidates = @()

  $onPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($onPath) { $candidates += $onPath.Source }

  foreach ($root in $roots) {
    Get-ChildItem -LiteralPath $root -Directory -Filter "Inno Setup*" -ErrorAction SilentlyContinue |
      ForEach-Object {
        $exe = Join-Path $_.FullName "ISCC.exe"
        if (Test-Path -LiteralPath $exe) { $candidates += $exe }
      }
  }


  # Wrapped in @() deliberately. With a single install, a bare pipeline returns
  # a plain string, and then $ranked[0] indexes into the string and yields a
  # single character ("C") instead of the path.
  $found = @($candidates | Select-Object -Unique)
  if (-not $found) {
    throw @"
Inno Setup was not found on this build machine.

Looked for ISCC.exe on PATH and under:
  $($roots -join [Environment]::NewLine + '  ')

Install Inno Setup 6 or later from https://jrsoftware.org/isdl.php, or add
ISCC.exe to PATH. This project does not pin a specific major version.
"@
  }

  # Prefer the highest major version, so a leftover 6.x does not shadow a 7.x.
  $ranked = @($found | Sort-Object -Property @{
    Expression = {
      $name = Split-Path (Split-Path $_ -Parent) -Leaf
      if ($name -match '(\d+)') { [int]$matches[1] } else { 0 }
    }
  } -Descending)

  # The version is derived from the install directory name and the Uninstall
  # key. It is deliberately NOT probed by executing "ISCC /?": that command
  # exits non-zero, and this script runs with $ErrorActionPreference = "Stop",
  # so a diagnostic call could terminate the build before it starts.
  $directory = Split-Path $ranked[0] -Parent
  $major = [regex]::Match((Split-Path $directory -Leaf), '(\d+)(?:\.(\d+))?')
  $script:isccVersion = if ($major.Success) {
    if ($major.Groups[2].Success) { "$($major.Groups[1].Value).$($major.Groups[2].Value)" } else { $major.Groups[1].Value }
  } else {
    "unknown"
  }
  $registered = @()
  foreach ($key in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )) {
    Get-ItemProperty $key -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like "Inno Setup*" } |
      ForEach-Object { $registered += "$($_.DisplayName)" }
  }
  if ($registered.Count -gt 0) { $script:isccVersion = ($registered -join ", ") }

  $ranked[0]
}

$iscc = Find-InnoCompiler
Write-Host "Inno Setup compiler: $iscc (version $($isccVersion))"
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

  # Sign-in is mandatory, so the template must ship with accounts already in it.
  # An empty template would produce an install that redirects every page to
  # /login and then rejects every credential, with no way for a user to recover
  # short of a reinstall. Seeding is idempotent, so this is safe to re-run.
  Write-Host "Seeding demo accounts into the database template"
  & npx tsx (Join-Path $repo "prisma\seed.ts")
  if ($LASTEXITCODE -ne 0) { throw "Could not seed the database template." }
} finally {
  $env:DATABASE_URL = $previousDatabaseUrl
}

# Verify the template really is usable before it is packaged. Failing here is
# far better than shipping an install that redirects to /login and then rejects
# every credential the operator was told about.
$verifyScript = @'
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  try {
    const users = await db.user.findMany({ select: { username: true, role: true } });
    const hasDeveloper = users.some((u) => u.role === "DEVELOPER");
    const hasAuthority = users.some((u) => u.role === "AUTHORITY");
    console.log(JSON.stringify({ count: users.length, hasDeveloper, hasAuthority }));
  } catch (error) {
    console.log(JSON.stringify({ count: 0, hasDeveloper: false, hasAuthority: false, error: String(error) }));
  } finally {
    await db.$disconnect();
  }
})();
'@
$verifyPath = Join-Path $stage "verify-template.cjs"
Write-Utf8NoBom $verifyPath $verifyScript
$verifyDatabaseUrl = $env:DATABASE_URL
try {
  # Point the check at the template, not at whatever the build machine happens
  # to have in .env, otherwise this verifies the wrong file entirely.
  $env:DATABASE_URL = "file:$($templateDb.Replace('\', '/'))"
  $verifyJson = & node $verifyPath
} finally {
  $env:DATABASE_URL = $verifyDatabaseUrl
}
$verified = $verifyJson | ConvertFrom-Json
if ($verified.count -lt 1 -or -not $verified.hasDeveloper -or -not $verified.hasAuthority) {
  throw "The database template has no usable accounts (Developer and Authority are both required). Refusing to build an installer that cannot be signed in to."
}
Write-Host "Database template verified: $($verified.count) account(s), both roles present."

$launcher = @'
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = __dirname;
const app = path.join(root, "app");
const template = path.join(root, "database", "custom.db");
const data = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "JalDrishti");
const db = path.join(data, "custom.db");
fs.mkdirSync(data, { recursive: true });

// SQLite files begin with the ASCII string "SQLite format 3\0". Checking it is
// cheap and it is the difference between a self-healing install and one that is
// bricked forever with an opaque "file is not a database" from Prisma.
//
// This is not hypothetical. An earlier launcher copied the template only when
// the destination was absent, so a single truncated, zero-length, or otherwise
// corrupt file - from a crash mid-copy, a full disk, or a previous bad build -
// was never replaced and the app could not create a project again.
function looksLikeSqlite(file) {
  try {
    const handle = fs.openSync(file, "r");
    try {
      const header = Buffer.alloc(100);
      const read = fs.readSync(handle, header, 0, 100, 0);
      if (read < 100) return false;
      if (header.toString("latin1", 0, 15) !== "SQLite format 3") return false;

      // The magic string alone is not enough: a 16-byte file containing only
      // "SQLite format 3\0" passes a naive check and would leave a truncated
      // database in place, failing on the first query instead. Validate the
      // page size too, and require the file to be at least one whole page.
      const declared = header.readUInt16BE(16);
      const pageSize = declared === 1 ? 65536 : declared;
      const isValidPageSize = pageSize >= 512 && (pageSize & (pageSize - 1)) === 0;
      if (!isValidPageSize) return false;
      return fs.fstatSync(handle).size >= pageSize;
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    return false;
  }
}

// SQLite stores the schema as plain SQL text inside the database file, so the
// presence of a table can be probed with a byte search and no driver. This
// matters because the installer keeps its AppId, so an install over an older
// build finds the previous database already in place and would otherwise run
// against a file that has no User, Session or Review tables. Sign-in is
// mandatory, so that is an install nobody can get past /login.
//
// The old file is quarantined rather than deleted, so nothing is destroyed
// before the cause is understood.
function hasCurrentSchema(file) {
  const REQUIRED = ['CREATE TABLE "User"', 'CREATE TABLE "Session"', 'CREATE TABLE "Review"'];
  try {
    const contents = fs.readFileSync(file, "latin1");
    return REQUIRED.every((needle) => contents.includes(needle));
  } catch {
    return false;
  }
}

if (!looksLikeSqlite(db)) {
  const reason = !fs.existsSync(db)
    ? "no database present"
    : `existing file is not a SQLite database (${fs.statSync(db).size} bytes)`;
  // Preserve the bad file rather than deleting it, so nothing is destroyed
  // before the cause is understood.
  const quarantine = `${db}.corrupt-${Date.now()}`;
  try {
    // Only rename when there is something to preserve; claiming a file was
    // kept when the directory was simply empty is misleading.
    const had = fs.existsSync(db);
    if (had) fs.renameSync(db, quarantine);
    fs.copyFileSync(template, db);
    console.log(`JalDrishti: restored the application database (${reason}).`);
    if (had) {
      console.log(`             The previous file was kept as ${path.basename(quarantine)}.`);
    }
  } catch (error) {
    console.error("JalDrishti: could not restore the application database:", error.message);
    console.error(`             Reinstalling is required. Expected a database at ${template}.`);
  }
  if (!looksLikeSqlite(db)) {
    console.error("JalDrishti: the restored database is still unreadable; the app cannot save projects.");
  }
} else if (!hasCurrentSchema(db)) {
  const quarantine = `${db}.outdated-${Date.now()}`;
  try {
    fs.renameSync(db, quarantine);
    fs.copyFileSync(template, db);
    console.log("JalDrishti: this database predates the current version and was replaced.");
    console.log(`             The previous file was kept as ${path.basename(quarantine)}.`);
    console.log("             Projects in it are not carried over; re-create them and re-run the screening.");
  } catch (error) {
    console.error("JalDrishti: could not upgrade the application database:", error.message);
    console.error("             Accounts may be unavailable until the app is reinstalled.");
  }
}

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
AppVersion=0.3.0
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
& $iscc $issPath
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed to create the installer." }

Write-Host "Installer created: $(Join-Path $output 'JalDrishti-Setup.exe')"
