import "server-only";
import { previousPeriod, type DateRange } from "@/lib/dates";
import type { FinanceAssumptions } from "@/lib/finance/assumptions";
import { computeProfit, type ProfitInputs, type ProfitMetrics } from "@/lib/finance/profit-engine";
import { aggregateOrders, dailySeries, productBreakdown, sumAdSpend, type OrderAggregate } from "./queries";

type Aggregate = Omit<OrderAggregate, "estimatedFeeOrders" | "estimatedCogsLines">;

/**
 * Maps SQL aggregates to profit-engine inputs.
 * Taxes are only deducted when prices include VAT (workspace VAT mode "INCLUDED").
 */
export function toProfitInputs(
  agg: Aggregate,
  adSpendCents: number,
  assumptions: Pick<FinanceAssumptions, "vatMode" | "otherVariableCostBps">,
): ProfitInputs {
  return {
    grossSalesCents: agg.grossSalesCents,
    shippingRevenueCents: agg.shippingRevenueCents,
    discountsCents: agg.discountsCents,
    refundsCents: agg.refundsCents,
    cogsCents: agg.cogsCents,
    shippingCostsCents: agg.shippingCostsCents,
    paymentFeesCents: agg.paymentFeesCents,
    taxesCents: assumptions.vatMode === "INCLUDED" ? agg.taxCents : 0,
    adSpendCents,
    orders: agg.orders,
    newCustomers: agg.newCustomers,
    otherVariableCostBps: assumptions.otherVariableCostBps,
  };
}

export interface DashboardData {
  range: DateRange;
  previousRange: DateRange;
  current: ProfitMetrics;
  previous: ProfitMetrics;
  /** Data quality flags for ACTUAL vs ESTIMATED labelling. */
  quality: { estimatedFeeOrders: number; estimatedCogsLines: number };
  series: { date: string; revenueCents: number; adSpendCents: number; profitCents: number; orders: number }[];
  products: (ProfitMetrics & { productId: string; title: string; imageUrl: string | null })[];
  /** Spend not mapped to any product (e.g. campaigns without a product mapping). */
  unassignedSpendCents: number;
}

export async function getDashboardData(input: {
  workspaceId: string;
  timezone: string;
  range: DateRange;
  assumptions: Pick<FinanceAssumptions, "vatMode" | "otherVariableCostBps">;
}): Promise<DashboardData> {
  const { workspaceId, timezone, range, assumptions } = input;
  const prev = previousPeriod(range);
  const scope = { workspaceId, timezone, from: range.from, to: range.to };
  const prevScope = { workspaceId, timezone, from: prev.from, to: prev.to };

  const [agg, spend, prevAgg, prevSpend, days, products] = await Promise.all([
    aggregateOrders(scope),
    sumAdSpend(scope),
    aggregateOrders(prevScope),
    sumAdSpend(prevScope),
    dailySeries(scope),
    productBreakdown(scope),
  ]);

  const productMetrics = products.map((p) => ({
    productId: p.productId,
    title: p.title,
    imageUrl: p.imageUrl,
    ...computeProfit(toProfitInputs(p, p.adSpendCents, assumptions)),
  }));
  const assignedSpend = products.reduce((s, p) => s + p.adSpendCents, 0);

  return {
    range,
    previousRange: prev,
    current: computeProfit(toProfitInputs(agg, spend, assumptions)),
    previous: computeProfit(toProfitInputs(prevAgg, prevSpend, assumptions)),
    quality: { estimatedFeeOrders: agg.estimatedFeeOrders, estimatedCogsLines: agg.estimatedCogsLines },
    series: days.map((d) => {
      const m = computeProfit(toProfitInputs(d, d.adSpendCents, assumptions));
      return {
        date: d.date,
        revenueCents: m.netRevenueCents,
        adSpendCents: d.adSpendCents,
        profitCents: m.netProfitCents,
        orders: d.orders,
      };
    }),
    products: productMetrics,
    unassignedSpendCents: Math.max(0, spend - assignedSpend),
  };
}
