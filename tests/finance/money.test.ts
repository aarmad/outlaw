import { describe, expect, it } from "vitest";
import {
  applyBps,
  centsToDecimalString,
  divideCents,
  parseMoneyInput,
  parsePercentInput,
  vatIncludedIn,
} from "@/lib/finance/money";
import { percentChange, safeRatio } from "@/lib/finance/ratios";

describe("applyBps", () => {
  it("computes a percentage of an amount in cents", () => {
    expect(applyBps(10_000, 290)).toBe(290); // 2.9 % of €100 = €2.90
  });

  it("rounds half away from zero", () => {
    expect(applyBps(2990, 300)).toBe(90); // 89.7 → 90
    expect(applyBps(50, 100)).toBe(1); // 0.5 → 1
    expect(applyBps(-50, 100)).toBe(-1);
  });

  it("rejects non-integer cents", () => {
    expect(() => applyBps(10.5, 100)).toThrow(RangeError);
  });
});

describe("vatIncludedIn", () => {
  it("extracts 20 % VAT from a VAT-inclusive price", () => {
    expect(vatIncludedIn(12_000, 2000)).toBe(2000); // €120 incl. → €20 VAT
    expect(vatIncludedIn(2990, 2000)).toBe(498); // net 2491.67 → 2492
  });

  it("returns 0 for a zero rate", () => {
    expect(vatIncludedIn(2990, 0)).toBe(0);
  });
});

describe("divideCents", () => {
  it("returns null instead of Infinity on zero divisor", () => {
    expect(divideCents(1000, 0)).toBeNull();
  });
  it("rounds to the nearest cent", () => {
    expect(divideCents(1000, 3)).toBe(333);
  });
});

describe("input parsing", () => {
  it("parses money with dot or comma", () => {
    expect(parseMoneyInput("29.90")).toBe(2990);
    expect(parseMoneyInput("29,9")).toBe(2990);
    expect(parseMoneyInput("4")).toBe(400);
    expect(parseMoneyInput("4.999")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
  });
  it("parses percentages to bps", () => {
    expect(parsePercentInput("2.9")).toBe(290);
    expect(parsePercentInput("20")).toBe(2000);
    expect(parsePercentInput("-1")).toBeNull();
  });
  it("formats cents as decimal strings", () => {
    expect(centsToDecimalString(2990)).toBe("29.90");
    expect(centsToDecimalString(-5)).toBe("-0.05");
  });
});

describe("ratios", () => {
  it("never produces Infinity or NaN", () => {
    expect(safeRatio(100, 0)).toBeNull();
    expect(safeRatio(0, 0)).toBeNull();
    expect(percentChange(100, 0)).toBeNull();
  });
  it("computes percent change", () => {
    expect(percentChange(2307, 1948)).toBeCloseTo(0.1843, 4);
    expect(percentChange(-50, -100)).toBeCloseTo(0.5);
  });
});
