/**
 * Install/uninstall the SessionEnd hook in ~/.claude/settings.json
 */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'hook.cjs');
const HOOK_DEST = join(homedir(), '.claude', 'cache-monitor-hook.cjs');
const HOOK_MARKER = 'cache-monitor-hook';

export async function installHook({ threshold = 0.7 } = {}) {
  // Copy hook script to ~/.claude/ for stable path
  await copyFile(HOOK_SCRIPT, HOOK_DEST);

  let settings;
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf8');
    settings = JSON.parse(raw);
  } catch {
    settings = {};
  }

  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.PostToolUse)) settings.hooks.PostToolUse = [];

  // Remove existing cache-monitor hook if present
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
    (h) => {
      // Check nested hooks structure
      const nested = h.hooks || [];
      return !nested.some((nh) => nh.command?.includes(HOOK_MARKER));
    },
  );

  // Add new hook (correct 3-level nested structure)
  // Normalize path separators for Windows compatibility in shell commands
  const hookPath = HOOK_DEST.replace(/\\/g, '/');
  settings.hooks.PostToolUse.push({
    matcher: 'Bash|Edit|Write',
    hooks: [
      {
        type: 'command',
        command: `node "${hookPath}" --threshold ${threshold}`,
        timeout: 10,
      },
    ],
  });

  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  console.log(`✓ Hook installed at ${HOOK_DEST}`);
  console.log(`  Settings updated: ${SETTINGS_PATH}`);
  console.log(`  Threshold: ${(threshold * 100).toFixed(0)}%`);
  console.log(`  Stats file: ~/.claude/cache-stats.jsonl`);
}

export async function uninstallHook() {
  let settings;
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf8');
    settings = JSON.parse(raw);
  } catch {
    console.log('No settings.json found, nothing to uninstall.');
    return;
  }

  if (settings.hooks?.PostToolUse) {
    const before = settings.hooks.PostToolUse.length;
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
      (h) => {
        const nested = h.hooks || [];
        return !nested.some((nh) => nh.command?.includes(HOOK_MARKER));
      },
    );
    const removed = before - settings.hooks.PostToolUse.length;

    if (settings.hooks.PostToolUse.length === 0) delete settings.hooks.PostToolUse;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

    await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    console.log(`✓ Removed ${removed} hook(s) from settings.json`);
  } else {
    console.log('No cache-monitor hook found in settings.');
  }
}
