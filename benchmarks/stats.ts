export interface Stats {
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
  stddev: number;
  count: number;
}

export function computeStats(times: number[]): Stats {
  if (times.length === 0) {
    return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0, stddev: 0, count: 0 };
  }

  const sorted = [...times].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / count;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count;

  return {
    min: sorted[0],
    p50: sorted[Math.floor(count * 0.5)],
    p95: sorted[Math.floor(count * 0.95)],
    p99: sorted[Math.floor(count * 0.99)],
    max: sorted[count - 1],
    mean,
    stddev: Math.sqrt(variance),
    count,
  };
}

export function formatMs(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
}
