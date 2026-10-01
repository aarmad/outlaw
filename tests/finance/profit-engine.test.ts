import { describe, expect, it } from "vitest";
import { computeProfit, EMPTY_PROFIT_INPUTS, type ProfitInputs } from "@/lib/finance/profit-engine";

/** Revenue €100, COGS €30, fees €5, ads €20. */
const simple: ProfitInputs = {
  ...EMPTY_PROFIT_INPUTS,
  grossSalesCents: 10_000,
  cogsCents: 3000,
  paymentFeesCents: 500,
  adSpendCents: 2000,
  orders: 2,
  newCustomers: 2,
};

describe("computeProfit — reference fixture", () => {
  const m = computeProfit(simple);

  it("contribution before ads = €65", () => {
    expect(m.contributionBeforeAdsCents).toBe(6500);
  });
  it("net profit = €45", () => {
    expect(m.netProfitCents).toBe(4500);
  });
  it("margin = 45 %", () => {
    expect(m.netMargin).toBeCloseTo(0.45, 10);
  });
  it("ROAS = 100 / 20 = 5", () => {
    expect(m.roas).toBe(5);
  });
  it("POAS = 65 / 20 = 3.25", () => {
    expect(m.poas).toBe(3.25);
  });
  it("MER = 100 / 20 = 5", () => {
    expect(m.mer).toBe(5);
  });
  it("CPA = 20 / 2 new customers = €10", () => {
    expect(m.cpaCents).toBe(1000);
  });
  it("break-even CPA = 65 / 2 orders = €32.50", () => {
    expect(m.breakEvenCpaCents).toBe(3250);
  });
  it("AOV = 100 / 2 = €50", () => {
    expect(m.aovCents).toBe(5000);
  });
});

describe("computeProfit — refunds, discounts, shipping, taxes", () => {
  const m = computeProfit({
    ...EMPTY_PROFIT_INPUTS,
    grossSalesCents: 20_000,
    shippingRevenueCents: 1000,
    discountsCents: 2000,
    refundsCents: 1500,
    cogsCents: 5000,
    shippingCostsCents: 1200,
    paymentFeesCents: 600,
    taxesCents: 2500,
    adSpendCents: 4000,
    orders: 5,
    newCustomers: 4,
  });

  it("net revenue = gross + shipping − discounts − refunds", () => {
    expect(m.totalSalesCents).toBe(19_000);
    expect(m.netRevenueCents).toBe(17_500);
  });
  it("contribution subtracts every variable cost", () => {
    expect(m.contributionBeforeAdsCents).toBe(17_500 - 5000 - 1200 - 600 - 2500);
  });
  it("MER uses total sales (before refunds), ROAS uses net revenue", () => {
    expect(m.mer).toBeCloseTo(19_000 / 4000, 10);
    expect(m.roas).toBeCloseTo(17_500 / 4000, 10);
  });
  it("CPA is per acquired customer, break-even CPA per order", () => {
    expect(m.cpaCents).toBe(1000);
    expect(m.breakEvenCpaCents).toBe(Math.round(8200 / 5));
  });
});

describe("computeProfit — variable costs", () => {
  it("estimates variable costs from bps of net revenue", () => {
    const m = computeProfit({ ...simple, otherVariableCostBps: 200 });
    expect(m.variableCostsCents).toBe(200);
    expect(m.contributionBeforeAdsCents).toBe(6300);
  });
  it("an actual amount overrides the estimate", () => {
    const m = computeProfit({ ...simple, otherVariableCostBps: 200, variableCostsCents: 50 });
    expect(m.variableCostsCents).toBe(50);
  });
});

describe("computeProfit — zero denominators", () => {
  const m = computeProfit(EMPTY_PROFIT_INPUTS);
  it("returns null rather than Infinity/NaN", () => {
    expect(m.netMargin).toBeNull();
    expect(m.roas).toBeNull();
    expect(m.poas).toBeNull();
    expect(m.mer).toBeNull();
    expect(m.cpaCents).toBeNull();
    expect(m.breakEvenCpaCents).toBeNull();
    expect(m.aovCents).toBeNull();
  });

  it("handles spend without orders (pure loss)", () => {
    const loss = computeProfit({ ...EMPTY_PROFIT_INPUTS, adSpendCents: 5000 });
    expect(loss.netProfitCents).toBe(-5000);
    expect(loss.roas).toBe(0);
    expect(loss.netMargin).toBeNull();
  });
});
