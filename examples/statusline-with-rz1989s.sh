#!/bin/sh
# Combine rz1989s/claude-code-statusline (rich layout: repo, cost, MCP, prayer times)
# with claude-token-saver (cache hit rate, TTL countdown, 1M-context detection,
# spike diagnosis). The two projects don't overlap — rz1989s runs first, our
# cache chip is appended as the final segment.
#
# Install:
#   1) Follow rz1989s install instructions so bash ~/.claude/statusline.sh works:
#      https://github.com/rz1989s/claude-code-statusline
#   2) npm install -g claude-token-saver   (or rely on npx — fallback below)
#   3) Save this file as: ~/.claude/statusline-with-rz1989s.sh
#      chmod +x ~/.claude/statusline-with-rz1989s.sh
#   4) In ~/.claude/settings.json:
#      {
#        "statusLine": {
#          "type": "command",
#          "command": "bash ~/.claude/statusline-with-rz1989s.sh",
#          "refreshInterval": 1
#        }
#      }
#
# refreshInterval: 1 keeps our TTL countdown ticking while you're idle.
# Drop to 2 or 5 for lower local CPU if your rz1989s config does heavy work.

# Claude Code sends the session JSON on stdin. Both tools want to read it,
# so we buffer it and tee to each.
input=$(cat)

# --- 1) rz1989s layout (if installed) ---
RZ_STATUSLINE="${CLAUDE_RZ_STATUSLINE:-$HOME/.claude/statusline.sh}"
if [ -f "$RZ_STATUSLINE" ]; then
  printf '%s' "$input" | bash "$RZ_STATUSLINE"
  # Separator between the two tools. Dim pipe.
  printf ' \033[90m|\033[00m '
fi

# --- 2) claude-token-saver ---
# Pass --exclude-session so the current session's tool calls don't reset the
# TTL countdown. The path comes from the session JSON if present.
session_path=$(printf '%s' "$input" | sed -n 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\.jsonl\)".*/\1/p' | head -n1)
exclude_flag=""
if [ -n "$session_path" ]; then
  exclude_flag="--exclude-session $session_path"
fi

if command -v claude-token-saver >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  claude-token-saver --statusline --icon $exclude_flag 2>/dev/null || true
else
  # shellcheck disable=SC2086
  npx --yes claude-token-saver@latest --statusline --icon $exclude_flag 2>/dev/null || true
fi
