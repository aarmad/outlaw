import { applyBps, type Bps, type Cents } from "./money";

export type HeadroomStatus = "NO_DATA" | "NOT_VIABLE" | "ABOVE_BREAK_EVEN" | "THIN" | "HEALTHY";

export interface Headroom {
  status: HeadroomStatus;
  /** Break-even CPA − CPA. Positive = room left per acquisition; negative = losing money. */
  headroomCents: Cents | null;
}

/**
 * Classifies acquisition economics against the workspace's configured safety buffer
 * (`targetCpaBufferBps`). A CPA below break-even but inside the buffer is "THIN": it is
 * profitable on paper but leaves little room for refunds, fee variance or attribution error.
 */
export function classifyHeadroom(
  cpaCents: Cents | null,
  breakEvenCpaCents: Cents | null,
  bufferBps: Bps,
): Headroom {
  if (breakEvenCpaCents === null) return { status: "NO_DATA", headroomCents: null };
  if (breakEvenCpaCents <= 0) return { status: "NOT_VIABLE", headroomCents: cpaCents === null ? null : breakEvenCpaCents - cpaCents };
  if (cpaCents === null) return { status: "NO_DATA", headroomCents: null };

  const headroomCents = breakEvenCpaCents - cpaCents;
  if (headroomCents < 0) return { status: "ABOVE_BREAK_EVEN", headroomCents };
  if (headroomCents < applyBps(breakEvenCpaCents, bufferBps)) return { status: "THIN", headroomCents };
  return { status: "HEALTHY", headroomCents };
}
