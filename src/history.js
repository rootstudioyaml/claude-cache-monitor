/**
 * Warning history — appends an entry whenever the active chip transitions
 * (none → warning, warning A → warning B, warning → none). One markdown file
 * per calendar day so users can pinpoint "when did this start" easily.
 *
 * Storage path is platform-aware (see paths.userDataDir):
 *   Windows: %APPDATA%\claude-token-saver\history\YYYY-MM-DD.md
 *   macOS:   ~/Library/Application Support/claude-token-saver/history/YYYY-MM-DD.md
 *   Linux:   ~/.config/claude-token-saver/history/YYYY-MM-DD.md
 *
 * State (last-seen chip, prevents duplicate appends every 1s refresh):
 *   <userDataDir>/last-chip.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { userDataDir } from './paths.js';

const BASE_DIR = userDataDir();
const HISTORY_DIR = join(BASE_DIR, 'history');
const STATE_PATH = join(BASE_DIR, 'last-chip.json');

export function historyDir() {
  return HISTORY_DIR;
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hms(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { chip: null, ts: null };
  }
}

function saveState(state) {
  ensureDir(BASE_DIR);
  writeFileSync(STATE_PATH, JSON.stringify(state) + '\n');
}

function appendDayLine(line, date = new Date()) {
  ensureDir(HISTORY_DIR);
  const path = join(HISTORY_DIR, `${ymd(date)}.md`);
  if (!existsSync(path)) {
    writeFileSync(path, `# Token Monitor — ${ymd(date)}\n\n## Events\n${line}\n`);
  } else {
    const existing = readFileSync(path, 'utf8');
    writeFileSync(path, existing.endsWith('\n') ? existing + line + '\n' : existing + '\n' + line + '\n');
  }
}

/**
 * Record a chip transition. Called from the statusline render path.
 * Returns `true` if a transition was logged, `false` if duplicate (same chip
 * as last call).
 */
export function recordChip(chip, contextHints = {}) {
  const state = loadState();
  const now = new Date();
  const current = chip || null;
  const last = state.chip || null;

  if (current === last) return false;

  let line;
  if (current && !last) {
    line = `- ${hms(now)} ${current}` + (contextHints.detail ? `  — ${contextHints.detail}` : '');
  } else if (current && last) {
    line = `- ${hms(now)} ${last} → ${current}` + (contextHints.detail ? `  — ${contextHints.detail}` : '');
  } else {
    // current === null, last was something — warning resolved
    line = `- ${hms(now)} ✓ resolved (was ${last})`;
  }
  appendDayLine(line, now);
  saveState({ chip: current, ts: now.toISOString() });
  return true;
}

/**
 * Read history files for the most recent N days (oldest first).
 * Returns array of { date, content } — empty content for days with no file.
 */
export function readRecent(days = 7) {
  ensureDir(HISTORY_DIR);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = ymd(d);
    const path = join(HISTORY_DIR, `${date}.md`);
    if (existsSync(path)) {
      out.push({ date, content: readFileSync(path, 'utf8') });
    }
  }
  return out;
}

/**
 * List all available history file dates (sorted newest first).
 */
export function listDates() {
  ensureDir(HISTORY_DIR);
  return readdirSync(HISTORY_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ''))
    .sort()
    .reverse();
}
