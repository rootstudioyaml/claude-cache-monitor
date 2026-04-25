#!/usr/bin/env bash
# Demo recorder — prints every warning scenario in sequence with a label.
# Use for terminal screencasts / asciinema / vhs recordings.
#
# Usage:
#   bash scripts/demo-recorder.sh                # default 3s per scenario
#   bash scripts/demo-recorder.sh 5              # 5s per scenario
#   bash scripts/demo-recorder.sh 3 compact      # text-compact style
#
# To embed in Claude Code's actual statusline (most authentic look),
# point ~/.claude/settings.json statusLine.command at:
#   claude-token-saver --statusline --demo cycle --demo-cycle-sec 3
# and open Claude Code while recording.

set -e

DELAY="${1:-3}"
MODE_FLAGS=""
case "${2:-}" in
  compact)        MODE_FLAGS="--text --compact" ;;
  text)           MODE_FLAGS="--text" ;;
  ""|verbose|icon)
                  MODE_FLAGS="" ;;     # use config defaults
  *)              MODE_FLAGS="$2" ;;
esac

SCENARIOS=(
  "healthy"
  "low-hit"
  "ttl-warning"
  "ttl-expiring"
  "ttl-expired"
  "5m-bucket"
  "ctx-1m"
  "spike-input"
  "spike-rebuild"
  "spike-output"
  "spike-calls"
)

CYAN='\033[36m'
GRAY='\033[90m'
RESET='\033[0m'

clear
printf "${CYAN}claude-token-saver — warning case demo${RESET}\n"
printf "${GRAY}each scenario shown for ${DELAY}s${RESET}\n\n"
sleep 1

for s in "${SCENARIOS[@]}"; do
  printf "${GRAY}▶ %s${RESET}\n" "$s"
  # shellcheck disable=SC2086
  claude-token-saver --statusline --demo "$s" $MODE_FLAGS
  printf "\n"
  sleep "$DELAY"
done

printf "${GRAY}── end of demo ──${RESET}\n"
