#!/bin/sh
# Claude Code statusline (POSIX sh — works on macOS, Linux, and WSL)
# Prints "user@host:cwd" then appends claude-token-saver as a second segment.
#
# Install:
#   1) npm install -g claude-token-saver
#   2) Save this file as: ~/.claude/statusline-command.sh
#      chmod +x ~/.claude/statusline-command.sh  (optional)
#   3) In ~/.claude/settings.json:
#      {
#        "statusLine": {
#          "type": "command",
#          "command": "bash ~/.claude/statusline-command.sh",
#          "refreshInterval": 1
#        }
#      }
#
# refreshInterval keeps the TTL countdown ticking while you're idle.
# Drop to 2 or 5 if you want lower local CPU.

input=$(cat)

# Extract cwd without jq dependency (jq may not be installed system-wide).
cwd=$(echo "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
cwd=${cwd:-$(pwd)}

# 1) user@host:cwd
printf '\033[01;32m%s@%s\033[00m:\033[01;34m%s\033[00m' "$(whoami)" "$(hostname -s)" "$cwd"

# 2) cache monitor (appended). Separator " | ". Falls back silently.
printf ' \033[90m|\033[00m '
if command -v claude-token-saver >/dev/null 2>&1; then
  claude-token-saver --statusline --icon 2>/dev/null || true
else
  npx --yes claude-token-saver@latest --statusline --icon 2>/dev/null || true
fi
