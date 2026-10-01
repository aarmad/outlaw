import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Headroom } from "@/lib/finance/headroom";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Status always carries an icon + text, never color alone. */
export function HeadroomBadge({ headroom, currency }: { headroom: Headroom; currency: string }) {
  const amount = headroom.headroomCents === null ? null : formatMoney(Math.abs(headroom.headroomCents), currency);
  switch (headroom.status) {
    case "HEALTHY":
      return (
        <Badge variant="outline" className={cn("gap-1 border-positive/30 text-positive")}>
          <CheckCircle2 /> {amount} headroom
        </Badge>
      );
    case "THIN":
      return (
        <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
          <AlertTriangle /> Thin · {amount} left
        </Badge>
      );
    case "ABOVE_BREAK_EVEN":
      return (
        <Badge variant="outline" className="gap-1 border-negative/30 text-negative">
          <XCircle /> {amount} above break-even
        </Badge>
      );
    case "NOT_VIABLE":
      return (
        <Badge variant="outline" className="gap-1 border-negative/30 text-negative">
          <XCircle /> Loses money before ads
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <CircleDashed /> Not enough data
        </Badge>
      );
  }
}
