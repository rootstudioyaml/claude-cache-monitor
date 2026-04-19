/**
 * Statusline formatter — compact single-line output for Claude Code statusline API.
 * Called every ~300ms, so kept minimal and fast. ANSI color codes included by default.
 *
 * Example output (color):
 *   🧠 97.5% · 1h · ⏱ 42:15 · 💰 $4.8K · 7d
 *
 * Disable color with NO_COLOR=1 env var or --no-color flag.
 * Disable the TTL countdown with --no-timer.
 *
 * Usage in ~/.claude/settings.json:
 *   {
 *     "statusLine": {
 *       "type": "command",
 *       "command": "npx claude-cache-monitor --statusline"
 *     }
 *   }
 */

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';

function formatMoney(usd) {
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 10) return `$${usd.toFixed(1)}`;
  return `$${usd.toFixed(2)}`;
}

function formatPct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

/**
 * Format a remaining-seconds countdown as MM:SS (or H:MM when ≥ 1h).
 */
function formatTimer(remainingSec) {
  if (remainingSec <= 0) return 'EXPIRED';
  const totalSec = Math.floor(remainingSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * @param {object} data - output of main report pipeline (summary, ttl, cost, options, lastActivity)
 * @param {object} [opts]
 * @param {boolean} [opts.color=true] - emit ANSI escape codes
 * @param {boolean} [opts.verbose=false] - longer layout with labels
 * @param {boolean} [opts.timer=true] - show TTL countdown segment
 */
export function formatReport(data, { color = true, verbose = false, timer = true } = {}) {
  const { summary, ttl, cost, options, lastActivity } = data;
  const { hitRate } = summary;

  // Hit rate → color signal
  const hitColor =
    hitRate >= 0.85 ? GREEN :
    hitRate >= 0.70 ? YELLOW :
    RED;

  // TTL dominance → color signal (1h = good, 5m = warning).
  // The subscription plan fixes this, so the bucket rarely changes — it's the countdown that matters.
  const is1h = ttl.pct1h >= 0.5;
  const ttlLabel = is1h ? '1h' : '5m';
  const ttlColor = is1h ? GREEN : YELLOW;
  const ttlSeconds = is1h ? 3600 : 300;

  const savings = cost?.savings ?? 0;

  const c = (v) => (color ? v : '');

  const hitSeg = `${c(BOLD)}🧠${c(RESET)} ${c(hitColor)}${formatPct(hitRate)}${c(RESET)}`;
  const ttlSeg = verbose
    ? `${c(ttlColor)}${ttlLabel} TTL${c(RESET)}`
    : `${c(ttlColor)}${ttlLabel}${c(RESET)}`;
  const saveSeg = verbose
    ? `${c(CYAN)}💰${c(RESET)} ${formatMoney(savings)} saved`
    : `${c(CYAN)}💰${c(RESET)} ${formatMoney(savings)}`;
  const periodSeg = `${c(GRAY)}${options.days}d${c(RESET)}`;

  // TTL countdown — how much time is left on the last API call's cache entry.
  let timerSeg = '';
  if (timer && lastActivity) {
    const elapsed = (Date.now() - lastActivity) / 1000;
    const remaining = ttlSeconds - elapsed;
    const text = formatTimer(remaining);
    // Color by fraction of TTL remaining.
    const pct = remaining / ttlSeconds;
    const timerColor =
      remaining <= 0 ? RED :
      pct > 0.30 ? GREEN :
      pct > 0.10 ? YELLOW :
      RED;
    timerSeg = verbose
      ? `${c(timerColor)}⏱ ${text} left${c(RESET)}`
      : `${c(timerColor)}⏱ ${text}${c(RESET)}`;
  }

  const segs = [hitSeg, ttlSeg];
  if (timerSeg) segs.push(timerSeg);
  segs.push(saveSeg, periodSeg);
  return segs.join(' · ');
}
