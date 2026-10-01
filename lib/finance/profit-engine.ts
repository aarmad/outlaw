import { applyBps, assertCents, divideCents, type Bps, type Cents } from "./money";
import { safeRatio, type Ratio } from "./ratios";

/**
 * Aggregated inputs for any scope (workspace, product, campaign…) over a date range.
 * Callers aggregate in SQL and pass totals here; formulas live only in this module.
 */
export interface ProfitInputs {
  /** Σ line price × quantity, before discounts. */
  grossSalesCents: Cents;
  /** Shipping charged to customers. */
  shippingRevenueCents: Cents;
  discountsCents: Cents;
  refundsCents: Cents;
  cogsCents: Cents;
  /** Our own fulfilment shipping cost. */
  shippingCostsCents: Cents;
  paymentFeesCents: Cents;
  /** Taxes that must be removed from revenue (e.g. VAT included in prices). */
  taxesCents: Cents;
  adSpendCents: Cents;
  orders: number;
  /** Orders from first-time customers. */
  newCustomers: number;
  /**
   * Other variable costs. Either an actual amount, or estimated as a share of net revenue
   * from `otherVariableCostBps`. An explicit amount wins.
   */
  variableCostsCents?: Cents;
  otherVariableCostBps?: Bps;
}

export interface ProfitMetrics {
  /** Gross sales + shipping revenue − discounts (before refunds). */
  totalSalesCents: Cents;
  /** Net Revenue = gross sales + shipping revenue − discounts − refunds */
  netRevenueCents: Cents;
  variableCostsCents: Cents;
  /** Net revenue − COGS − shipping − payment fees − variable costs − taxes */
  contributionBeforeAdsCents: Cents;
  adSpendCents: Cents;
  /** Contribution before ads − ad spend */
  netProfitCents: Cents;
  /** Net profit / net revenue */
  netMargin: Ratio;
  /** Net revenue / ad spend */
  roas: Ratio;
  /** Contribution before ads / ad spend — profit on ad spend */
  poas: Ratio;
  /** Total sales / total ad spend — blended, independent of attribution */
  mer: Ratio;
  /** Ad spend / new customers */
  cpaCents: Cents | null;
  /** Contribution before ads / orders — the max you could pay per order and break even */
  breakEvenCpaCents: Cents | null;
  /** Total sales / orders */
  aovCents: Cents | null;
  orders: number;
  newCustomers: number;
}

export function computeProfit(input: ProfitInputs): ProfitMetrics {
  for (const key of [
    "grossSalesCents",
    "shippingRevenueCents",
    "discountsCents",
    "refundsCents",
    "cogsCents",
    "shippingCostsCents",
    "paymentFeesCents",
    "taxesCents",
    "adSpendCents",
  ] as const) {
    assertCents(input[key], key);
  }

  const totalSalesCents = input.grossSalesCents + input.shippingRevenueCents - input.discountsCents;
  const netRevenueCents = totalSalesCents - input.refundsCents;
  const variableCostsCents =
    input.variableCostsCents ?? applyBps(netRevenueCents, input.otherVariableCostBps ?? 0);

  const contributionBeforeAdsCents =
    netRevenueCents -
    input.cogsCents -
    input.shippingCostsCents -
    input.paymentFeesCents -
    variableCostsCents -
    input.taxesCents;
  const netProfitCents = contributionBeforeAdsCents - input.adSpendCents;

  return {
    totalSalesCents,
    netRevenueCents,
    variableCostsCents,
    contributionBeforeAdsCents,
    adSpendCents: input.adSpendCents,
    netProfitCents,
    netMargin: safeRatio(netProfitCents, netRevenueCents),
    roas: safeRatio(netRevenueCents, input.adSpendCents),
    poas: safeRatio(contributionBeforeAdsCents, input.adSpendCents),
    mer: safeRatio(totalSalesCents, input.adSpendCents),
    cpaCents: divideCents(input.adSpendCents, input.newCustomers),
    breakEvenCpaCents: divideCents(contributionBeforeAdsCents, input.orders),
    aovCents: divideCents(totalSalesCents, input.orders),
    orders: input.orders,
    newCustomers: input.newCustomers,
  };
}

export const EMPTY_PROFIT_INPUTS: ProfitInputs = {
  grossSalesCents: 0,
  shippingRevenueCents: 0,
  discountsCents: 0,
  refundsCents: 0,
  cogsCents: 0,
  shippingCostsCents: 0,
  paymentFeesCents: 0,
  taxesCents: 0,
  adSpendCents: 0,
  orders: 0,
  newCustomers: 0,
};
