/**
 * Cost impact estimation based on Anthropic pricing.
 * Prices per million tokens (as of 2026-04).
 */

const PRICING = {
  'claude-sonnet': {
    input: 3.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
    output: 15.0,
  },
  'claude-opus': {
    input: 15.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
    output: 75.0,
  },
  'claude-haiku': {
    input: 0.8,
    cacheWrite: 1.0,
    cacheRead: 0.08,
    output: 4.0,
  },
};

function detectPricingTier(model) {
  if (!model) return 'claude-sonnet';
  const m = model.toLowerCase();
  if (m.includes('opus')) return 'claude-opus';
  if (m.includes('haiku')) return 'claude-haiku';
  return 'claude-sonnet';
}

function tokensToMillions(n) {
  return n / 1_000_000;
}

/**
 * Estimate costs for given token totals.
 */
export function estimateCost(totals, model) {
  const tier = detectPricingTier(model);
  const p = PRICING[tier];

  const actual =
    tokensToMillions(totals.input) * p.input +
    tokensToMillions(totals.cacheCreation) * p.cacheWrite +
    tokensToMillions(totals.cacheRead) * p.cacheRead +
    tokensToMillions(totals.output) * p.output;

  // What it would cost without any caching
  const totalInput = totals.input + totals.cacheCreation + totals.cacheRead;
  const noCacheCost =
    tokensToMillions(totalInput) * p.input +
    tokensToMillions(totals.output) * p.output;

  // What it would cost if all 1h-tier writes had been 5m instead
  // (higher miss rate — estimate 3x more cache re-creation for sessions > 5min)
  const extra5mCreation = totals.ephemeral1h * 2; // sessions that would re-create
  const scenario5mCost =
    tokensToMillions(totals.input) * p.input +
    tokensToMillions(totals.cacheCreation + extra5mCreation) * p.cacheWrite +
    tokensToMillions(Math.max(0, totals.cacheRead - extra5mCreation)) * p.cacheRead +
    tokensToMillions(totals.output) * p.output;

  return {
    tier,
    actual: round(actual),
    noCacheCost: round(noCacheCost),
    savings: round(noCacheCost - actual),
    savingsRate: noCacheCost > 0 ? (noCacheCost - actual) / noCacheCost : 0,
    scenario5mCost: round(scenario5mCost),
    extraCostIf5m: round(scenario5mCost - actual),
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
