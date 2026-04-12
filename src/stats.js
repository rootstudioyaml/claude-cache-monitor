/**
 * Aggregate session data into daily trends, TTL breakdown, and anomalies.
 */

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function hitRate(read, creation, input) {
  const total = read + creation + input;
  return total > 0 ? read / total : 0;
}

/**
 * Daily cache hit rate trend
 */
export function dailyTrend(sessions) {
  const byDay = new Map();

  for (const s of sessions) {
    if (!s.startTime) continue;
    const day = dateKey(s.startTime);
    if (!byDay.has(day)) {
      byDay.set(day, {
        date: day,
        input: 0,
        cacheCreation: 0,
        cacheRead: 0,
        ephemeral5m: 0,
        ephemeral1h: 0,
        output: 0,
        apiCalls: 0,
        sessions: 0,
      });
    }
    const d = byDay.get(day);
    d.input += s.totals.input;
    d.cacheCreation += s.totals.cacheCreation;
    d.cacheRead += s.totals.cacheRead;
    d.ephemeral5m += s.totals.ephemeral5m;
    d.ephemeral1h += s.totals.ephemeral1h;
    d.output += s.totals.output;
    d.apiCalls += s.requestCount;
    d.sessions += 1;
  }

  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      hitRate: hitRate(d.cacheRead, d.cacheCreation, d.input),
      totalInput: d.cacheRead + d.cacheCreation + d.input,
    }));
}

/**
 * TTL breakdown summary
 */
export function ttlBreakdown(sessions) {
  let total5m = 0;
  let total1h = 0;

  for (const s of sessions) {
    total5m += s.totals.ephemeral5m;
    total1h += s.totals.ephemeral1h;
  }

  const total = total5m + total1h;
  return {
    ephemeral5m: total5m,
    ephemeral1h: total1h,
    total,
    pct5m: total > 0 ? total5m / total : 0,
    pct1h: total > 0 ? total1h / total : 0,
  };
}

/**
 * Detect anomalies — days where hit rate drops significantly from rolling average
 */
export function detectAnomalies(trend, { threshold = 0.15 } = {}) {
  const anomalies = [];
  const windowSize = 7;

  for (let i = 0; i < trend.length; i++) {
    const day = trend[i];
    if (day.apiCalls < 5) continue; // skip low-volume days

    // rolling average of prior days
    const windowStart = Math.max(0, i - windowSize);
    const window = trend.slice(windowStart, i);
    if (window.length < 3) continue;

    const avgHitRate =
      window.reduce((sum, d) => sum + d.hitRate, 0) / window.length;

    const drop = avgHitRate - day.hitRate;
    if (drop > threshold) {
      anomalies.push({
        date: day.date,
        hitRate: day.hitRate,
        avgHitRate,
        drop,
        apiCalls: day.apiCalls,
      });
    }
  }

  return anomalies;
}

/**
 * Overall summary
 */
export function summary(sessions) {
  const totals = sessions.reduce(
    (acc, s) => {
      acc.input += s.totals.input;
      acc.cacheCreation += s.totals.cacheCreation;
      acc.cacheRead += s.totals.cacheRead;
      acc.ephemeral5m += s.totals.ephemeral5m;
      acc.ephemeral1h += s.totals.ephemeral1h;
      acc.output += s.totals.output;
      acc.apiCalls += s.requestCount;
      acc.sessions += 1;
      return acc;
    },
    { input: 0, cacheCreation: 0, cacheRead: 0, ephemeral5m: 0, ephemeral1h: 0, output: 0, apiCalls: 0, sessions: 0 },
  );

  const totalInput = totals.cacheRead + totals.cacheCreation + totals.input;

  return {
    ...totals,
    totalInput,
    hitRate: hitRate(totals.cacheRead, totals.cacheCreation, totals.input),
  };
}
