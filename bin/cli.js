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
 */

import { parseAllSessions } from '../src/parser.js';
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

  // Report generation
  const days = parseInt(getArg('--days') || getArg('-d') || '30', 10);
  const format = getArg('--format') || getArg('-f') || 'table';
  const projectFilter = getArg('--project') || getArg('-p');

  if (format === 'table') {
    process.stderr.write('Scanning session files...\n');
  }

  const sessions = await parseAllSessions({ days, projectFilter });

  if (sessions.length === 0) {
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

  const data = { summary: sum, trend, ttl, anomalies, cost, options: { days } };

  let output;
  if (format === 'json') {
    const { formatReport } = await import('../src/formatters/json.js');
    output = formatReport(data);
  } else if (format === 'csv') {
    const { formatReport } = await import('../src/formatters/csv.js');
    output = formatReport(data);
  } else {
    const { formatReport } = await import('../src/formatters/table.js');
    output = formatReport(data);
  }

  console.log(output);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
