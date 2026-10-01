import { Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { classifyHeadroom } from "@/lib/finance/headroom";
import type { ProfitMetrics } from "@/lib/finance/profit-engine";
import { formatInteger, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HeadroomBadge } from "./headroom-badge";

type Row = ProfitMetrics & { productId: string; title: string; imageUrl: string | null };

export function ProductProfitTable({
  rows,
  currency,
  cpaBufferBps,
}: {
  rows: Row[];
  currency: string;
  cpaBufferBps: number;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Ad spend</TableHead>
            <TableHead className="text-right">CPA</TableHead>
            <TableHead className="text-right">Break-even CPA</TableHead>
            <TableHead className="text-right">Net profit</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead>Acquisition</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.productId}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" className="size-8 rounded-md border object-cover" />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
                      <Package className="size-4 text-muted-foreground" />
                    </span>
                  )}
                  <span className="font-medium">{r.title}</span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular">{formatInteger(r.orders, currency)}</TableCell>
              <TableCell className="text-right tabular">{formatMoney(r.netRevenueCents, currency)}</TableCell>
              <TableCell className="text-right tabular">{formatMoney(r.adSpendCents, currency)}</TableCell>
              <TableCell className="text-right tabular">{formatMoney(r.cpaCents, currency)}</TableCell>
              <TableCell className="text-right tabular">{formatMoney(r.breakEvenCpaCents, currency)}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular",
                  r.netProfitCents > 0 && "text-positive",
                  r.netProfitCents < 0 && "text-negative",
                )}
              >
                {formatMoney(r.netProfitCents, currency, { signed: true })}
              </TableCell>
              <TableCell className="text-right tabular">{formatPercent(r.netMargin, { currency })}</TableCell>
              <TableCell>
                <HeadroomBadge headroom={classifyHeadroom(r.cpaCents, r.breakEvenCpaCents, cpaBufferBps)} currency={currency} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
