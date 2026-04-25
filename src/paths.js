/**
 * Cross-platform user-data path resolution.
 *
 * Order of precedence:
 *   1. $XDG_CONFIG_HOME (explicit override, honored on every platform)
 *   2. %APPDATA% on Windows (e.g. C:\Users\foo\AppData\Roaming)
 *   3. ~/Library/Application Support on macOS
 *   4. ~/.config on Linux / fallback
 *
 * All paths are joined via node:path so the OS-correct separator is used
 * automatically. Callers are responsible for `mkdirSync(..., { recursive: true })`
 * before writing — every helper here returns a path string only.
 */

import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Returns the base directory for this tool's user-level data
 * (config, history, last-chip state).
 */
export function userDataDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, 'claude-token-saver');
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'claude-token-saver');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'claude-token-saver');
  }
  return join(homedir(), '.config', 'claude-token-saver');
}

/**
 * Returns the user's Claude Code config root (~/.claude on every OS Claude
 * Code supports — the CLI itself uses this path on Windows and macOS too).
 */
export function claudeUserDir() {
  return join(homedir(), '.claude');
}
