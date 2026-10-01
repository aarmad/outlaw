"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PerformancePoint {
  date: string;
  revenueCents: number;
  adSpendCents: number;
  profitCents: number;
}

const SERIES = [
  { key: "revenueCents", label: "Revenue", color: "var(--series-revenue)", kind: "line" },
  { key: "adSpendCents", label: "Ad spend", color: "var(--series-spend)", kind: "line" },
  { key: "profitCents", label: "Net profit", color: "var(--series-profit)", kind: "bar" },
] as const;

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function PerformanceChart({ data, currency }: { data: PerformancePoint[]; currency: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const money = (v: number) => formatMoney(v, currency, { compact: true });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("inline-block", s.kind === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]")}
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Button
            size="icon-sm"
            variant={view === "chart" ? "secondary" : "ghost"}
            onClick={() => setView("chart")}
            aria-label="Show chart"
            aria-pressed={view === "chart"}
          >
            <BarChart3 />
          </Button>
          <Button
            size="icon-sm"
            variant={view === "table" ? "secondary" : "ghost"}
            onClick={() => setView("table")}
            aria-label="Show table"
            aria-pressed={view === "table"}
          >
            <Table2 />
          </Button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={dayLabel}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={money}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="mb-1 font-medium">{dayLabel(String(label))}</div>
                      {SERIES.map((s) => {
                        const v = payload[0].payload[s.key] as number;
                        return (
                          <div key={s.key} className="flex items-center justify-between gap-6">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-2 rounded-full" style={{ background: s.color }} />
                              {s.label}
                            </span>
                            <span className="font-medium tabular text-foreground">{formatMoney(v, currency)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null
                }
              />
              <Bar isAnimationActive={false} dataKey="profitCents" name="Net profit" fill="var(--series-profit)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="revenueCents"
                name="Revenue"
                stroke="var(--series-revenue)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="adSpendCents"
                name="Ad spend"
                stroke="var(--series-spend)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-72 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Ad spend</TableHead>
                <TableHead className="text-right">Net profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{dayLabel(d.date)}</TableCell>
                  <TableCell className="text-right tabular">{formatMoney(d.revenueCents, currency)}</TableCell>
                  <TableCell className="text-right tabular">{formatMoney(d.adSpendCents, currency)}</TableCell>
                  <TableCell
                    className={cn("text-right tabular", d.profitCents < 0 && "text-negative")}
                  >
                    {formatMoney(d.profitCents, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
