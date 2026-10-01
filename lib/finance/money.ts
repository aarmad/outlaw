/**
 * Money primitives. All amounts are integer minor units (cents). All rates are integer
 * basis points (1 bps = 0.01 %). Rounding uses BigInt so it is exact for any realistic amount.
 */

export type Cents = number;
export type Bps = number;

export const BPS_DENOMINATOR = 10_000;

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer number of cents, got ${value}`);
  }
  return value;
}

/** Integer division rounding half away from zero (commercial rounding). */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n * 2n + d) / (d * 2n);
  return negative ? -q : q;
}

/** amount × bps / 10 000, rounded to the nearest cent. */
export function applyBps(amount: Cents, bps: Bps): Cents {
  assertCents(amount);
  assertCents(bps, "bps");
  return Number(divRound(BigInt(amount) * BigInt(bps), BigInt(BPS_DENOMINATOR)));
}

/**
 * VAT contained in a VAT-inclusive gross amount:
 * vat = gross − gross / (1 + rate)
 */
export function vatIncludedIn(gross: Cents, rateBps: Bps): Cents {
  assertCents(gross);
  if (rateBps <= 0) return 0;
  const net = divRound(BigInt(gross) * BigInt(BPS_DENOMINATOR), BigInt(BPS_DENOMINATOR + rateBps));
  return gross - Number(net);
}

/** Integer division of cents by a count, rounded to the nearest cent. */
export function divideCents(amount: Cents, by: number): Cents | null {
  if (by === 0) return null;
  assertCents(amount);
  assertCents(by, "divisor");
  return Number(divRound(BigInt(amount), BigInt(by)));
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += assertCents(v);
  return assertCents(total, "sum");
}

/** Convert a user-entered decimal (e.g. "29.90" or "29,90") to cents. Returns null if invalid. */
export function parseMoneyInput(input: string): Cents | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const negative = normalized.startsWith("-");
  const [whole, frac = ""] = normalized.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Convert a user-entered percentage (e.g. "2.9") to basis points. */
export function parsePercentInput(input: string): Bps | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, frac = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToDecimalString(amount: Cents): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const s = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${s}` : s;
}

export function bpsToPercentString(bps: Bps): string {
  return (bps / 100).toString();
}
