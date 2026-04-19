/**
 * Statusline formatter — compact single-line output for Claude Code statusline API.
 * Called every ~300ms, so kept minimal and fast. ANSI color codes included by default.
 *
 * Example output (color):
 *   🧠 97.5% · 1h TTL · 💰 $4.8K saved · 7d
 *
 * Disable color with NO_COLOR=1 env var or --no-color flag.
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
 * @param {object} data - output of main report pipeline (summary, ttl, cost, options)
 * @param {object} [opts]
 * @param {boolean} [opts.color=true] - emit ANSI escape codes
 * @param {boolean} [opts.verbose=false] - longer layout with labels
 */
export function formatReport(data, { color = true, verbose = false } = {}) {
  const { summary, ttl, cost, options } = data;
  const { hitRate } = summary;

  // Hit rate → color signal
  const hitColor =
    hitRate >= 0.85 ? GREEN :
    hitRate >= 0.70 ? YELLOW :
    RED;

  // TTL dominance → color signal (1h = good, 5m = warning)
  const ttlLabel = ttl.pct1h >= 0.5 ? '1h' : '5m';
  const ttlColor = ttl.pct1h >= 0.5 ? GREEN : YELLOW;

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

  return [hitSeg, ttlSeg, saveSeg, periodSeg].join(' · ');
}
