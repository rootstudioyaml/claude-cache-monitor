/**
 * Terminal table formatter — zero dependencies.
 */

function pad(str, len, align = 'left') {
  const s = String(str);
  if (align === 'right') return s.padStart(len);
  return s.padEnd(len);
}

function pct(n) {
  return (n * 100).toFixed(1) + '%';
}

function millions(n) {
  return (n / 1_000_000).toFixed(2) + 'M';
}

function thousands(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function hr(len) {
  return '─'.repeat(len);
}

function tableRow(cols, widths, aligns) {
  return (
    '│ ' +
    cols.map((c, i) => pad(c, widths[i], aligns[i])).join(' │ ') +
    ' │'
  );
}

function tableSep(widths) {
  return '├─' + widths.map((w) => hr(w)).join('─┼─') + '─┤';
}

function tableTop(widths) {
  return '┌─' + widths.map((w) => hr(w)).join('─┬─') + '─┐';
}

function tableBot(widths) {
  return '└─' + widths.map((w) => hr(w)).join('─┴─') + '─┘';
}

/**
 * Format the full report for terminal output.
 */
export function formatReport({ summary: sum, trend, ttl, anomalies, cost, options }) {
  const lines = [];

  // Header
  lines.push('');
  lines.push(`  Claude Cache Monitor — Last ${options.days} days`);
  lines.push(`  ${'═'.repeat(50)}`);
  lines.push('');

  // Overall summary
  lines.push('  Summary');
  lines.push(`  Sessions: ${sum.sessions}  |  API calls: ${sum.apiCalls.toLocaleString()}  |  Model: ${cost.tier}`);
  lines.push(`  Cache hit rate: ${pct(sum.hitRate)}  |  Total input: ${millions(sum.totalInput)} tokens`);
  lines.push('');

  // TTL breakdown
  lines.push('  TTL Breakdown');
  const ttlW = [18, 16, 16];
  const ttlA = ['left', 'right', 'right'];
  lines.push('  ' + tableTop(ttlW));
  lines.push('  ' + tableRow(['', '5m Ephemeral', '1h Extended'], ttlW, ttlA));
  lines.push('  ' + tableSep(ttlW));
  lines.push(
    '  ' +
      tableRow(
        [
          'Cache writes',
          `${thousands(ttl.ephemeral5m)} (${pct(ttl.pct5m)})`,
          `${thousands(ttl.ephemeral1h)} (${pct(ttl.pct1h)})`,
        ],
        ttlW,
        ttlA,
      ),
  );
  lines.push('  ' + tableBot(ttlW));
  lines.push('');

  // Cost impact
  lines.push('  Cost Impact (estimated)');
  const costW = [24, 12];
  const costA = ['left', 'right'];
  lines.push('  ' + tableTop(costW));
  lines.push('  ' + tableRow(['Actual cost', `$${cost.actual}`], costW, costA));
  lines.push('  ' + tableRow(['Without cache', `$${cost.noCacheCost}`], costW, costA));
  lines.push('  ' + tableSep(costW));
  lines.push('  ' + tableRow(['Savings', `$${cost.savings} (${pct(cost.savingsRate)})`], costW, costA));
  lines.push('  ' + tableRow(['Extra cost if 5m-only', `+$${cost.extraCostIf5m}`], costW, costA));
  lines.push('  ' + tableBot(costW));
  lines.push('');

  // Daily trend
  lines.push('  Daily Trend');
  const tw = [10, 8, 7, 10, 10, 5];
  const ta = ['left', 'right', 'right', 'right', 'right', 'right'];
  lines.push('  ' + tableTop(tw));
  lines.push('  ' + tableRow(['Date', 'HitRate', 'Calls', 'Read', 'Write', '5m%'], tw, ta));
  lines.push('  ' + tableSep(tw));

  const recentTrend = trend.slice(-14); // last 14 days
  for (const d of recentTrend) {
    const ccTotal = d.ephemeral5m + d.ephemeral1h;
    const pct5m = ccTotal > 0 ? pct(d.ephemeral5m / ccTotal) : '-';
    lines.push(
      '  ' +
        tableRow(
          [d.date, pct(d.hitRate), String(d.apiCalls), millions(d.cacheRead), millions(d.cacheCreation), pct5m],
          tw,
          ta,
        ),
    );
  }
  lines.push('  ' + tableBot(tw));

  if (trend.length > 14) {
    lines.push(`  ... ${trend.length - 14} earlier days omitted (use --format json for full data)`);
  }
  lines.push('');

  // Anomalies
  if (anomalies.length > 0) {
    lines.push('  ⚠ Anomalies Detected');
    for (const a of anomalies) {
      lines.push(
        `    ${a.date}: hit rate ${pct(a.hitRate)} (7-day avg: ${pct(a.avgHitRate)}, drop: -${pct(a.drop)}) [${a.apiCalls} calls]`,
      );
    }
  } else {
    lines.push('  ✓ No anomalies detected');
  }

  lines.push('');
  return lines.join('\n');
}
