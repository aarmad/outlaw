import type { Bps, Cents } from "./money";

export type VatMode = "NONE" | "INCLUDED";

/**
 * Workspace-level economic assumptions (see /settings/finance). They are used for
 * simulations and to ESTIMATE values that are not yet known from real data.
 */
export interface FinanceAssumptions {
  paymentFeeBps: Bps;
  paymentFixedFeeCents: Cents;
  /** Share of revenue expected to be refunded (simulations only). */
  refundBufferBps: Bps;
  /** NONE: no VAT handling. INCLUDED: selling prices include VAT, which is not your money. */
  vatMode: VatMode;
  vatRateBps: Bps;
  /** Other variable costs (apps, chargebacks, …) as a share of revenue. */
  otherVariableCostBps: Bps;
}

export const DEFAULT_ASSUMPTIONS: FinanceAssumptions = {
  paymentFeeBps: 290,
  paymentFixedFeeCents: 30,
  refundBufferBps: 300,
  vatMode: "NONE",
  vatRateBps: 2000,
  otherVariableCostBps: 0,
};
