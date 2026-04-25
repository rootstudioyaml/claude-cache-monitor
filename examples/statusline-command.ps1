# Claude Code statusline (Windows PowerShell version)
# Mirrors the POSIX sh script — prints "user@host:cwd" then appends
# claude-token-saver output as a second segment.
#
# Install:
#   1) npm install -g claude-token-saver
#   2) Save this file as: %USERPROFILE%\.claude\statusline-command.ps1
#   3) In %USERPROFILE%\.claude\settings.json add:
#      {
#        "statusLine": {
#          "type": "command",
#          "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File %USERPROFILE%\\.claude\\statusline-command.ps1",
#          "refreshInterval": 1
#        }
#      }
#
# Requires Windows Terminal or PowerShell 7+ for ANSI color + emoji rendering.
# (Classic conhost cmd renders colors but may garble emoji.)

$stdin = [Console]::In.ReadToEnd()

# Extract cwd from the JSON payload without requiring jq.
$cwdMatch = [regex]::Match($stdin, '"cwd"\s*:\s*"([^"]*)"')
$cwd = if ($cwdMatch.Success) { $cwdMatch.Groups[1].Value } else { (Get-Location).Path }

# 1) user@host:cwd  (ANSI: green user@host, blue cwd)
$esc = [char]27
Write-Host -NoNewline "$esc[01;32m$env:USERNAME@$env:COMPUTERNAME$esc[00m`:$esc[01;34m$cwd$esc[00m"

# 2) cache monitor (appended). Separator " | ". Falls back silently.
Write-Host -NoNewline " $esc[90m|$esc[00m "

$cacheMonitor = Get-Command claude-token-saver -ErrorAction SilentlyContinue
if ($cacheMonitor) {
  try {
    & claude-token-saver --statusline --icon 2>$null
  } catch { }
} else {
  # fallback: npx (first run downloads the package; subsequent runs are warm)
  try {
    & npx --yes claude-token-saver@latest --statusline --icon 2>$null
  } catch { }
}
