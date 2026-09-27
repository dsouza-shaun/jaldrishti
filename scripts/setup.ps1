<#
.SYNOPSIS
  One-time setup for a fresh clone of JalDrishti.

.DESCRIPTION
  Runs every step a new user needs, in order, and stops at the first failure:
    1. checks Node.js and npm are present and new enough
    2. installs dependencies
    3. creates the db/ folder
    4. copies .env.example to .env, if it does not exist yet
    5. creates the SQLite schema
    6. generates the Prisma client
    7. seeds the demo accounts and starter projects
    8. optionally starts the dev server

  Safe to re-run. Seeding is idempotent, so accounts are refreshed rather than
  duplicated, and an existing .env is never overwritten.

.EXAMPLE
  .\scripts\setup.ps1
  .\scripts\setup.ps1 -Start
  .\scripts\setup.ps1 -Start -Port 3000
#>
[CmdletBinding()]
param(
  # Start the dev server once setup finishes.
  [switch]$Start,
  # Port for the dev server when -Start is used.
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  Write-Host ''
  Write-Host "Setup failed: $Message" -ForegroundColor Red
  exit 1
}

# 1. Toolchain ---------------------------------------------------------------
Step 'Checking Node.js and npm'

# Every later step runs inside the repository, not wherever this file happened to
# be invoked from. Without this, npm install and the prisma commands act on the
# caller's current directory instead of the checkout.
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repo
Write-Host "    working in $repo"

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { Fail 'node.exe was not found. Install Node.js 20.9 or newer from https://nodejs.org' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Fail 'npm was not found. It ships with Node.js.' }

$versionText = (& node --version).TrimStart('v')
$version = [version]$versionText
if ($version -lt [version]'20.9.0') {
  Fail "Node.js $versionText is too old. This project needs 20.9 or newer."
}
Write-Host "    Node.js $versionText, npm $((& npm --version))"

# 2. Dependencies ------------------------------------------------------------
Step 'Installing dependencies'
& npm install
if ($LASTEXITCODE -ne 0) { Fail 'npm install did not complete.' }

# 3. Database folder ---------------------------------------------------------
Step 'Creating the db folder'
$dbDir = Join-Path $repo 'db'
if (-not (Test-Path -LiteralPath $dbDir)) {
  New-Item -ItemType Directory -Path $dbDir | Out-Null
  Write-Host "    created $dbDir"
} else {
  Write-Host '    already present'
}

# 4. Environment file -------------------------------------------------------
Step 'Preparing .env'
$envFile = Join-Path $repo '.env'
$exampleFile = Join-Path $repo '.env.example'
if (Test-Path -LiteralPath $envFile) {
  Write-Host '    .env already exists, leaving it untouched'
} elseif (Test-Path -LiteralPath $exampleFile) {
  Copy-Item -LiteralPath $exampleFile -Destination $envFile
  Write-Host '    created .env from .env.example'
} else {
  Write-Host '    .env.example not found, skipping'
}
Write-Host '    AI explanations stay off until GROQ_API_KEY is set in .env'

# 5. Schema -----------------------------------------------------------------
Step 'Creating the database schema'
& npx prisma db push --schema (Join-Path $repo 'prisma\schema.prisma') --accept-data-loss
if ($LASTEXITCODE -ne 0) { Fail 'prisma db push did not complete.' }

# 6. Prisma client ----------------------------------------------------------
Step 'Generating the Prisma client'
& npx prisma generate --schema (Join-Path $repo 'prisma\schema.prisma')
if ($LASTEXITCODE -ne 0) { Fail 'prisma generate did not complete.' }

# 7. Seed -------------------------------------------------------------------
Step 'Seeding demo accounts and starter projects'
& npx tsx (Join-Path $repo 'prisma\seed.ts')
if ($LASTEXITCODE -ne 0) { Fail 'The seed did not complete. The app would start with no way to sign in.' }

# 8. Done --------------------------------------------------------------------
Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host ''
Write-Host '  Sign in at http://localhost:' + $Port
Write-Host '    developer / dev@demo     run screenings'
Write-Host '    developer2 / dev2@demo   a second developer, for testing access rules'
Write-Host '    authority / auth@demo    review submitted screenings'
Write-Host ''

if ($Start) {
  Write-Host "Starting the dev server on port $Port. Press Ctrl+C to stop." -ForegroundColor Cyan
  Write-Host ''
  $env:PORT = $Port
  & npm run dev
} else {
  Write-Host 'Next: run "npm run dev"'
  Write-Host ''
}
