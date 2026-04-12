export function formatReport({ trend }) {
  const header = 'date,hit_rate,api_calls,cache_read,cache_creation,ephemeral_5m,ephemeral_1h,input,output';
  const rows = trend.map(
    (d) =>
      `${d.date},${d.hitRate.toFixed(4)},${d.apiCalls},${d.cacheRead},${d.cacheCreation},${d.ephemeral5m},${d.ephemeral1h},${d.input},${d.output}`,
  );
  return [header, ...rows].join('\n');
}
