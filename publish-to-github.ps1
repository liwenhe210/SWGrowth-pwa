param(
  [string]$Destination = "C:\Users\30566\Documents\GitHub\SWGrowth-pwa",
  [string]$CommitMessage = "Update SWGrowth PWA",
  [switch]$Commit,
  [switch]$Push
)

$ErrorActionPreference = "Stop"

if ($Push) {
  $Commit = $true
}

$source = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$destinationPath = (Resolve-Path -LiteralPath $Destination).Path
$gitDirectory = Join-Path $destinationPath ".git"

if (-not (Test-Path -LiteralPath $gitDirectory)) {
  throw "Destination is not a Git repository: $destinationPath"
}

$expectedRemote = "https://github.com/liwenhe210/SWGrowth-pwa.git"
$remote = (& git -C $destinationPath remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $remote -ne $expectedRemote) {
  throw "Unexpected origin remote: $remote"
}

$statusBefore = & git -C $destinationPath status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read destination repository status."
}
if ($statusBefore) {
  throw "Destination repository has uncommitted changes. Resolve them before publishing.`n$statusBefore"
}

if ($Push) {
  & git -C $destinationPath fetch origin main
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to fetch origin/main. Publish stopped."
  }
  $localHead = (& git -C $destinationPath rev-parse HEAD).Trim()
  $remoteHead = (& git -C $destinationPath rev-parse origin/main).Trim()
  if ($localHead -ne $remoteHead) {
    throw "Local main and origin/main differ. Synchronize the repository before publishing."
  }
}

$backupRoot = Join-Path (Split-Path $destinationPath -Parent) "SWGrowth-pwa-backups"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupRoot "SWGrowth-pwa-$timestamp.bundle"

& git -C $destinationPath bundle create $backupPath HEAD
if ($LASTEXITCODE -ne 0) {
  throw "Unable to create the Git bundle backup."
}

$publishItems = @(
  ".gitignore",
  "AI_INTEGRATION_PLAN.md",
  "AI_SETUP.md",
  "MAINTENANCE.md",
  "PROMPT_GUIDE.md",
  "README.md",
  "REMOTE_PUBLISH_WORKFLOW.md",
  "SUPABASE_SETUP.md",
  "SYNC_AND_AI_PLAN.md",
  "app.js",
  "assets",
  "dev-server.mjs",
  "index.html",
  "manifest.webmanifest",
  "publish-to-github.ps1",
  "styles.css",
  "supabase",
  "supabase-ai-schema.sql",
  "supabase-config.js",
  "supabase-schema.sql",
  "sw.js",
  "verify-pwa.mjs"
)

foreach ($item in $publishItems) {
  $sourceItem = Join-Path $source $item
  if (-not (Test-Path -LiteralPath $sourceItem)) {
    continue
  }

  $destinationItem = Join-Path $destinationPath $item
  if ((Get-Item -LiteralPath $sourceItem).PSIsContainer) {
    New-Item -ItemType Directory -Force -Path $destinationItem | Out-Null
    Copy-Item -Path (Join-Path $sourceItem "*") -Destination $destinationItem -Recurse -Force
  } else {
    $parent = Split-Path $destinationItem -Parent
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Copy-Item -LiteralPath $sourceItem -Destination $destinationItem -Force
  }
}

& node --check (Join-Path $destinationPath "app.js")
if ($LASTEXITCODE -ne 0) {
  throw "app.js syntax check failed."
}

& node --check (Join-Path $destinationPath "sw.js")
if ($LASTEXITCODE -ne 0) {
  throw "sw.js syntax check failed."
}

& node --check (Join-Path $destinationPath "supabase\functions\ai-game-master\index.ts")
if ($LASTEXITCODE -ne 0) {
  throw "Edge Function syntax check failed."
}

& git -C $destinationPath diff --check
if ($LASTEXITCODE -ne 0) {
  throw "Git diff check failed."
}

$statusAfter = & git -C $destinationPath status --short
Write-Host "Backup created: $backupPath"

if (-not $statusAfter) {
  Write-Host "The GitHub clone already matches the development directory."
  exit 0
}

Write-Host "Pending publish changes:"
$statusAfter | ForEach-Object { Write-Host $_ }

if (-not $Commit) {
  Write-Host "Preview complete. Use -Commit, or -Commit -Push after review."
  exit 0
}

& git -C $destinationPath add -A
if ($LASTEXITCODE -ne 0) {
  throw "Git staging failed."
}

& git -C $destinationPath commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
  throw "Git commit failed."
}

if ($Push) {
  & git -C $destinationPath push origin main
  if ($LASTEXITCODE -ne 0) {
    throw "Git push failed. The local commit was preserved."
  }
  Write-Host "Pushed to origin/main."
} else {
  Write-Host "Local commit created. It has not been pushed."
}
