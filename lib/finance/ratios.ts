/**
 * Ratio helpers. A ratio with a zero denominator is `null` — never Infinity or NaN —
 * so the UI can explain *why* there is no value (e.g. "No ad spend in this period").
 */

export type Ratio = number | null;

export function safeRatio(numerator: number, denominator: number): Ratio {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  return numerator / denominator;
}

/** Relative change from `previous` to `current`, as a fraction (0.184 = +18.4 %). */
export function percentChange(current: number, previous: number): Ratio {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
