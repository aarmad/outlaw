import { describe, expect, it } from "vitest";
import type { FinanceAssumptions } from "@/lib/finance/assumptions";
import { computeTierEconomics, landedCost } from "@/lib/finance/unit-economics";

const unitCost = { productCostCents: 420, shippingCostCents: 210, otherCostCents: 0 };

const shopifyPaymentsNoVat: FinanceAssumptions = {
  paymentFeeBps: 290,
  paymentFixedFeeCents: 30,
  refundBufferBps: 300,
  vatMode: "NONE",
  vatRateBps: 2000,
  otherVariableCostBps: 0,
};

const noFees: FinanceAssumptions = {
  paymentFeeBps: 0,
  paymentFixedFeeCents: 0,
  refundBufferBps: 0,
  vatMode: "NONE",
  vatRateBps: 0,
  otherVariableCostBps: 0,
};

describe("landedCost", () => {
  it("adds product, shipping and other cost", () => {
    expect(landedCost({ productCostCents: 420, shippingCostCents: 210, otherCostCents: 50 })).toBe(680);
  });
});

describe("computeTierEconomics", () => {
  it("simple fixture: €100 price, €30 COGS, no fees → break-even CPA €70, ROAS 1.43", () => {
    const e = computeTierEconomics(
      {
        quantity: 1,
        priceCents: 10_000,
        unitCost: { productCostCents: 2000, shippingCostCents: 1000, otherCostCents: 0 },
      },
      noFees,
    );
    expect(e.cogsCents).toBe(3000);
    expect(e.contributionCents).toBe(7000);
    expect(e.breakEvenCpaCents).toBe(7000);
    expect(e.breakEvenRoas).toBeCloseTo(10_000 / 7000, 10);
    expect(e.contributionMargin).toBeCloseTo(0.7, 10);
  });

  it("single unit at €29.90 with payment fees and refund buffer", () => {
    const e = computeTierEconomics({ quantity: 1, priceCents: 2990, unitCost }, shopifyPaymentsNoVat);
    expect(e.cogsCents).toBe(630);
    expect(e.paymentFeesCents).toBe(117); // 86.71 → 87 + 30 fixed
    expect(e.refundBufferCents).toBe(90); // 89.7 → 90
    expect(e.vatCents).toBe(0);
    expect(e.contributionCents).toBe(2990 - 630 - 117 - 90);
    expect(e.breakEvenCpaCents).toBe(2153);
    expect(e.breakEvenRoas).toBeCloseTo(2990 / 2153, 10);
    expect(e.viable).toBe(true);
  });

  it("bundle COGS = quantity × unit product cost + shipping", () => {
    const e = computeTierEconomics({ quantity: 2, priceCents: 4490, unitCost }, shopifyPaymentsNoVat);
    expect(e.productCostCents).toBe(840);
    expect(e.shippingCostCents).toBe(420);
    expect(e.cogsCents).toBe(1260);
    expect(e.unitPriceCents).toBe(2245);
    expect(e.breakEvenCpaCents).toBe(4490 - 1260 - 160 - 135);
  });

  it("uses a per-order shipping override when the supplier ships a bundle together", () => {
    const e = computeTierEconomics(
      { quantity: 3, priceCents: 5990, unitCost, shippingCostOverrideCents: 350 },
      noFees,
    );
    expect(e.cogsCents).toBe(3 * 420 + 350);
  });

  it("removes VAT when prices include VAT", () => {
    const e = computeTierEconomics(
      { quantity: 1, priceCents: 2990, unitCost },
      { ...noFees, vatMode: "INCLUDED", vatRateBps: 2000 },
    );
    expect(e.vatCents).toBe(498);
    expect(e.contributionCents).toBe(2990 - 630 - 498);
  });

  it("flags a tier that loses money before any ad spend", () => {
    const e = computeTierEconomics({ quantity: 1, priceCents: 600, unitCost }, shopifyPaymentsNoVat);
    expect(e.viable).toBe(false);
    expect(e.breakEvenCpaCents).toBeLessThan(0);
    expect(e.breakEvenRoas).toBeNull();
  });

  it("rejects invalid quantities", () => {
    expect(() => computeTierEconomics({ quantity: 0, priceCents: 1000, unitCost }, noFees)).toThrow();
  });
});
