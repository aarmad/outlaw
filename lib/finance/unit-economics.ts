import type { FinanceAssumptions } from "./assumptions";
import { applyBps, assertCents, divideCents, vatIncludedIn, type Cents } from "./money";
import { safeRatio, type Ratio } from "./ratios";

/** Per-unit landed cost components of a product. */
export interface UnitCost {
  productCostCents: Cents;
  shippingCostCents: Cents;
  otherCostCents: Cents;
}

/** landed_cost = product_cost + shipping_cost + other_cost */
export function landedCost(cost: UnitCost): Cents {
  return (
    assertCents(cost.productCostCents, "productCost") +
    assertCents(cost.shippingCostCents, "shippingCost") +
    assertCents(cost.otherCostCents, "otherCost")
  );
}

export interface OfferTierInput {
  quantity: number;
  /** Price paid by the customer for the whole tier (e.g. 2 units for €44.90). */
  priceCents: Cents;
  unitCost: UnitCost;
  /** Shipping cost for the whole order. Defaults to quantity × unit shipping cost. */
  shippingCostOverrideCents?: Cents | null;
}

export interface OfferTierEconomics {
  quantity: number;
  revenueCents: Cents;
  unitPriceCents: Cents;
  /** quantity × (product cost + other cost) */
  productCostCents: Cents;
  shippingCostCents: Cents;
  /** COGS = quantity × unit product cost + shipping cost (+ other per-unit costs) */
  cogsCents: Cents;
  paymentFeesCents: Cents;
  vatCents: Cents;
  refundBufferCents: Cents;
  variableCostsCents: Cents;
  /** Revenue − all variable costs before advertising. */
  contributionCents: Cents;
  contributionMargin: Ratio;
  /** Maximum ad cost per order before the order loses money. Equals the contribution. */
  breakEvenCpaCents: Cents;
  /** Revenue / break-even CPA; null when the tier cannot be profitable at any CPA. */
  breakEvenRoas: Ratio;
  /** False when contribution ≤ 0: the tier loses money even with zero ad spend. */
  viable: boolean;
}

/**
 * Economics of one offer tier (bundle) before advertising.
 *
 *   Revenue            = selling_price
 *   COGS               = quantity × unit_product_cost + shipping_cost
 *   Contribution       = Revenue − COGS − payment_fees − VAT (if included)
 *                        − refund_buffer − other_variable_costs
 *   Break-even CPA     = Contribution
 *   Break-even ROAS    = Revenue / Break-even CPA
 */
export function computeTierEconomics(
  input: OfferTierInput,
  assumptions: FinanceAssumptions,
): OfferTierEconomics {
  const { quantity, priceCents, unitCost } = input;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError(`quantity must be a positive integer, got ${quantity}`);
  }
  assertCents(priceCents, "price");

  const productCostCents = quantity * (unitCost.productCostCents + unitCost.otherCostCents);
  const shippingCostCents =
    input.shippingCostOverrideCents ?? quantity * unitCost.shippingCostCents;
  const cogsCents = productCostCents + shippingCostCents;

  const paymentFeesCents =
    priceCents > 0 ? applyBps(priceCents, assumptions.paymentFeeBps) + assumptions.paymentFixedFeeCents : 0;
  const vatCents =
    assumptions.vatMode === "INCLUDED" ? vatIncludedIn(priceCents, assumptions.vatRateBps) : 0;
  const refundBufferCents = applyBps(priceCents, assumptions.refundBufferBps);
  const variableCostsCents = applyBps(priceCents, assumptions.otherVariableCostBps);

  const contributionCents =
    priceCents - cogsCents - paymentFeesCents - vatCents - refundBufferCents - variableCostsCents;
  const viable = contributionCents > 0;

  return {
    quantity,
    revenueCents: priceCents,
    unitPriceCents: divideCents(priceCents, quantity) ?? 0,
    productCostCents,
    shippingCostCents,
    cogsCents,
    paymentFeesCents,
    vatCents,
    refundBufferCents,
    variableCostsCents,
    contributionCents,
    contributionMargin: safeRatio(contributionCents, priceCents),
    breakEvenCpaCents: contributionCents,
    breakEvenRoas: viable ? safeRatio(priceCents, contributionCents) : null,
    viable,
  };
}
