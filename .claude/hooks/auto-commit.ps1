# Auto-commit and push changes after Claude Code finishes responding
$ErrorActionPreference = 'SilentlyContinue'

Set-Location $env:CLAUDE_PROJECT_DIR

# Check for any changes (staged, unstaged, or untracked)
$status = git status --porcelain
if (-not $status) {
    exit 0
}

# Stage all changes
git add -A

# Build a descriptive commit message from the changed files
$diff = git diff --cached --stat
$files = git diff --cached --name-only
$fileCount = ($files | Measure-Object).Count
$summary = ($files | ForEach-Object { Split-Path $_ -Leaf }) -join ', '

# Truncate summary if too long
if ($summary.Length -gt 120) {
    $summary = $summary.Substring(0, 117) + '...'
}

$message = "Auto-commit: Update $fileCount file(s) — $summary"

# Commit
git commit -m $message

# Push to remote (don't fail if push fails)
$branch = git branch --show-current
git push origin $branch 2>$null

exit 0
