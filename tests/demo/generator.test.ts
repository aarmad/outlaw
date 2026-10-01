import { describe, expect, it } from "vitest";
import { generateDemoDataset } from "@/lib/demo/generator";
import { DEFAULT_ASSUMPTIONS } from "@/lib/finance/assumptions";
import { computeProfit, EMPTY_PROFIT_INPUTS } from "@/lib/finance/profit-engine";

const now = new Date("2026-10-01T15:00:00Z");
const opts = {
  workspaceId: "00000000-0000-4000-8000-000000000000",
  currency: "EUR",
  timezone: "Europe/Paris",
  now,
  assumptions: DEFAULT_ASSUMPTIONS,
};
const data = generateDemoDataset(opts);

describe("demo dataset — shape", () => {
  it("has the expected structure", () => {
    expect(data.products).toHaveLength(3);
    expect(data.campaigns).toHaveLength(5);
    expect(data.adSets).toHaveLength(10);
    expect(data.ads).toHaveLength(20);
    expect(data.insights).toHaveLength(20 * 30);
    expect(data.orders.length).toBeGreaterThan(100);
    expect(data.lineItems).toHaveLength(data.orders.length);
    expect(data.attributions).toHaveLength(data.orders.length);
  });

  it("is deterministic for a given seed and clock", () => {
    const again = generateDemoDataset(opts);
    expect(again.orders.map((o) => o.totalRevenueCents)).toEqual(data.orders.map((o) => o.totalRevenueCents));
  });

  it("never creates orders or refunds in the future", () => {
    expect(data.orders.every((o) => o.orderedAt <= now)).toBe(true);
    expect(data.refunds.every((r) => r.refundedAt <= now)).toBe(true);
  });

  it("uses unique external ids (idempotent re-seed)", () => {
    const ids = data.orders.map((o) => o.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("demo dataset — financial consistency", () => {
  it("line COGS = quantity × unit cost snapshotted at order time", () => {
    for (const li of data.lineItems) expect(li.cogsCents).toBe((li.unitCostCents ?? 0) * li.quantity);
  });

  it("applies the supplier cost increase only to orders after it took effect", () => {
    const posture = data.products.find((p) => p.title.startsWith("Posture"))!;
    const change = data.costHistory
      .filter((c) => c.productId === posture.id)
      .sort((a, b) => +a.effectiveFrom! - +b.effectiveFrom!)[1];
    const orderById = new Map(data.orders.map((o) => [o.id, o]));
    const postureLines = data.lineItems.filter((li) => li.productId === posture.id);
    for (const li of postureLines) {
      const orderedAt = orderById.get(li.orderId)!.orderedAt;
      expect(li.unitCostCents).toBe(orderedAt >= change.effectiveFrom! ? 420 : 380);
    }
    expect(postureLines.some((li) => li.unitCostCents === 380)).toBe(true);
    expect(postureLines.some((li) => li.unitCostCents === 420)).toBe(true);
  });

  it("order totals = subtotal − discounts and refunds never exceed totals", () => {
    for (const o of data.orders) {
      expect(o.totalRevenueCents).toBe(o.subtotalCents - (o.discountsCents ?? 0));
      expect(o.refundedCents ?? 0).toBeLessThanOrEqual(o.totalRevenueCents);
    }
  });

  it("tells the intended story: Broad #3 is above break-even, Phone Mount has headroom", () => {
    const adSetMetrics = (adSetName: string, productTitle: string) => {
      const product = data.products.find((p) => p.title.startsWith(productTitle))!;
      const campaignIds = new Set(data.campaigns.filter((c) => c.productId === product.id).map((c) => c.id));
      const adSet = data.adSets.find((s) => s.name === adSetName && campaignIds.has(s.campaignId))!;
      const adIds = new Set(data.ads.filter((a) => a.adSetId === adSet.id).map((a) => a.id));
      const orderIds = new Set(data.attributions.filter((a) => a.adSetId === adSet.id).map((a) => a.orderId));
      const os = data.orders.filter((o) => orderIds.has(o.id!));
      const lis = data.lineItems.filter((li) => orderIds.has(li.orderId));
      return computeProfit({
        ...EMPTY_PROFIT_INPUTS,
        grossSalesCents: os.reduce((s, o) => s + o.subtotalCents, 0),
        discountsCents: os.reduce((s, o) => s + (o.discountsCents ?? 0), 0),
        refundsCents: os.reduce((s, o) => s + (o.refundedCents ?? 0), 0),
        cogsCents: lis.reduce((s, l) => s + (l.cogsCents ?? 0), 0),
        shippingCostsCents: os.reduce((s, o) => s + (o.shippingCostCents ?? 0), 0),
        paymentFeesCents: os.reduce((s, o) => s + (o.paymentFeesCents ?? 0), 0),
        adSpendCents: data.insights.filter((i) => adIds.has(i.adId)).reduce((s, i) => s + (i.spendCents ?? 0), 0),
        orders: os.length,
        newCustomers: os.filter((o) => o.isFirstOrder).length,
      });
    };

    const loser = adSetMetrics("Broad #3", "Posture");
    expect(loser.cpaCents!).toBeGreaterThan(loser.breakEvenCpaCents!);
    expect(loser.netProfitCents).toBeLessThan(0);

    const winner = adSetMetrics("LAL Purchasers 2%", "Magnetic");
    expect(winner.cpaCents!).toBeLessThan(winner.breakEvenCpaCents! * 0.75);
    expect(winner.netProfitCents).toBeGreaterThan(0);
  });

  it("Meta reports more purchases than our UTM-matched orders", () => {
    const metaPurchases = data.insights.reduce((s, i) => s + (i.metaPurchases ?? 0), 0);
    const matched = data.attributions.filter((a) => a.method === "UTM_MATCH").length;
    expect(metaPurchases).toBeGreaterThan(matched);
    expect(data.attributions.some((a) => a.method === "UNATTRIBUTED")).toBe(true);
  });
});
