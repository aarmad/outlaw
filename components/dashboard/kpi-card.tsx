import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { METRIC_DEFINITIONS, type MetricKey } from "@/lib/finance/definitions";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "up-good": an increase is good (profit). "up-bad": an increase is bad (CPA).
 * "neutral": direction alone says nothing (ad spend).
 */
export type Polarity = "up-good" | "up-bad" | "neutral";

export function KpiCard({
  metric,
  value,
  change,
  polarity = "up-good",
  emptyReason,
  tone,
  footnote,
}: {
  metric: MetricKey;
  value: string;
  /** Fractional change vs previous period, or null when not computable. */
  change: number | null;
  polarity?: Polarity;
  /** Why the value is empty (e.g. "No ad spend"). */
  emptyReason?: string;
  tone?: "positive" | "negative";
  footnote?: string;
}) {
  const def = METRIC_DEFINITIONS[metric];
  return (
    <Card className="gap-0 py-4">
      <CardContent className="grid gap-1.5 px-4">
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {def.label}
          <Tooltip>
            <TooltipTrigger aria-label={`How ${def.label} is calculated`} className="text-muted-foreground/70 hover:text-foreground">
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              <p className="font-medium">{def.formula}</p>
              <p className="mt-1 opacity-80">{def.help}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
          )}
          title={emptyReason}
        >
          {value}
        </div>
        <div className="flex min-h-5 items-center gap-1.5 text-xs">
          {emptyReason ? (
            <span className="text-muted-foreground">{emptyReason}</span>
          ) : (
            <DeltaBadge change={change} polarity={polarity} />
          )}
          {footnote ? <span className="text-muted-foreground">{footnote}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function DeltaBadge({ change, polarity }: { change: number | null; polarity: Polarity }) {
  if (change === null) return <span className="text-muted-foreground">No prior-period data</span>;
  const flat = Math.abs(change) < 0.0005;
  const up = change > 0;
  const good = polarity === "neutral" || flat ? null : polarity === "up-good" ? up : !up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular",
        good === true && "text-positive",
        good === false && "text-negative",
        good === null && "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatPercent(change, { signed: true })}
      <span className="sr-only">{good === null ? "" : good ? "(improvement)" : "(deterioration)"}</span>
      <span className="ml-1 font-normal text-muted-foreground">vs prev.</span>
    </span>
  );
}
