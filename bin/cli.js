#!/usr/bin/env node

/**
 * claude-cache-monitor CLI
 *
 * Usage:
 *   npx claude-cache-monitor                    # default report (last 30 days)
 *   npx claude-cache-monitor --days 7           # last 7 days
 *   npx claude-cache-monitor --format json      # JSON output
 *   npx claude-cache-monitor --format csv       # CSV output
 *   npx claude-cache-monitor --project myproj   # filter by project
 *   npx claude-cache-monitor --install-hook     # install PostToolUse hook
 *   npx claude-cache-monitor --uninstall-hook   # remove hook
 *   npx claude-cache-monitor --hook-run         # internal: called by hook
 *   npx claude-cache-monitor --statusline       # one-line output for Claude Code statusline API
 *   npx claude-cache-monitor --statusline --verbose  # longer labels
 *   npx claude-cache-monitor --statusline --no-color # strip ANSI colors
 *   npx claude-cache-monitor --statusline --icon     # use 🧠 ⏳ 💰 icons
 *   npx claude-cache-monitor --statusline --no-timer # hide the TTL countdown
 *   npx claude-cache-monitor --statusline --exclude-session <path>
 *                                               # exclude a JSONL path from lastActivity
 *                                               # (or set CACHE_MONITOR_EXCLUDE_SESSION env var)
 */

import { parseAllSessions, getLastUserMessageTime } from '../src/parser.js';
import { dailyTrend, ttlBreakdown, detectAnomalies, summary } from '../src/stats.js';
import { estimateCost } from '../src/cost.js';

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(name);
}

async function main() {
  // Hook management
  if (hasFlag('--install-hook')) {
    const { installHook } = await import('../src/hook-manager.js');
    const threshold = parseFloat(getArg('--threshold') || '0.7');
    await installHook({ threshold });
    return;
  }

  if (hasFlag('--uninstall-hook')) {
    const { uninstallHook } = await import('../src/hook-manager.js');
    await uninstallHook();
    return;
  }

  // Hook internal execution
  if (hasFlag('--hook-run')) {
    await import('../src/hook.cjs');
    return;
  }

  // Statusline mode shortcut
  const isStatusline = hasFlag('--statusline') || getArg('--format') === 'statusline';

  // Report generation
  // Statusline default = 7 days (fast, called every ~300ms). Others = 30 days.
  const defaultDays = isStatusline ? 7 : 30;
  const days = parseInt(getArg('--days') || getArg('-d') || String(defaultDays), 10);
  const format = isStatusline ? 'statusline' : (getArg('--format') || getArg('-f') || 'table');
  const projectFilter = getArg('--project') || getArg('-p');

  if (format === 'table') {
    process.stderr.write('Scanning session files...\n');
  }

  // Exclude the current Claude Code session when computing lastActivity —
  // otherwise the agent's own tool calls reset the countdown every few seconds.
  const excludeSessionPath =
    getArg('--exclude-session') || process.env.CACHE_MONITOR_EXCLUDE_SESSION || undefined;

  const sessions = await parseAllSessions({ days, projectFilter, excludeSessionPath });

  if (sessions.length === 0) {
    // Statusline must always emit a single line (no multi-line help spam every 300ms)
    if (format === 'statusline') {
      const colorOk = !hasFlag('--no-color') && !process.env.NO_COLOR;
      const gray = colorOk ? '\x1b[90m' : '';
      const reset = colorOk ? '\x1b[0m' : '';
      console.log(`${gray}🧠 no session data · ${days}d${reset}`);
      return;
    }
    console.log('No session data found for the given period.');
    console.log('');
    console.log('This tool analyzes Claude Code session logs (~/.claude/projects/).');
    console.log('');
    console.log('Possible causes:');
    console.log('  - You haven\'t used Claude Code in the last ' + days + ' days');
    console.log('  - You\'re using the Claude API directly (SDK/curl) without Claude Code');
    console.log('    → This tool requires Claude Code. API-only usage does not generate session logs.');
    console.log('  - Try increasing the period: --days 90');
    process.exit(1);
  }

  const trend = dailyTrend(sessions);
  const ttl = ttlBreakdown(sessions);
  const sum = summary(sessions);
  const anomalies = detectAnomalies(trend);
  const cost = estimateCost(sum, sessions[0]?.model);

  // Last API activity feeds the statusline TTL countdown.
  // For every session that wasn't excluded, take the full endTime (any API call
  // keeps the prefix cache warm — it doesn't matter whether it's user- or
  // agent-driven because the cache is shared across sessions by prefix content).
  const otherLastActivity = sessions
    .map((s) => (s.endTime ? s.endTime.getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  // For the excluded (current) session, only the user's prompts count — the
  // agent's tool calls would otherwise reset the countdown every few seconds
  // as long as Claude Code is streaming a response.
  let currentSessionLastUser = 0;
  if (excludeSessionPath) {
    try {
      const t = await getLastUserMessageTime(excludeSessionPath);
      if (t) currentSessionLastUser = t.getTime();
    } catch {
      // ignore — keep 0 so it doesn't raise the max
    }
  }
  const lastActivity = Math.max(otherLastActivity, currentSessionLastUser);

  const data = { summary: sum, trend, ttl, anomalies, cost, options: { days }, lastActivity };

  let output;
  if (format === 'json') {
    const { formatReport } = await import('../src/formatters/json.js');
    output = formatReport(data);
  } else if (format === 'csv') {
    const { formatReport } = await import('../src/formatters/csv.js');
    output = formatReport(data);
  } else if (format === 'statusline') {
    const { formatReport } = await import('../src/formatters/statusline.js');
    const colorOk = !hasFlag('--no-color') && !process.env.NO_COLOR;
    const mode = hasFlag('--icon') ? 'icon' : 'text';
    output = formatReport(data, {
      color: colorOk,
      verbose: hasFlag('--verbose'),
      timer: !hasFlag('--no-timer'),
      mode,
    });
  } else {
    const { formatReport } = await import('../src/formatters/table.js');
    output = formatReport(data);
  }

  console.log(output);
}

main().catch((err) => {
  // Statusline mode must never spam multi-line errors (called every ~300ms)
  const isStatusline = process.argv.includes('--statusline') || process.argv.includes('statusline');
  if (isStatusline) {
    const colorOk = !process.argv.includes('--no-color') && !process.env.NO_COLOR;
    const red = colorOk ? '\x1b[31m' : '';
    const reset = colorOk ? '\x1b[0m' : '';
    console.log(`${red}🧠 error${reset}`);
    process.exit(0);
  }
  console.error('Error:', err.message);
  process.exit(1);
});
