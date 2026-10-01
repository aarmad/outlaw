import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/dashboard/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requireWorkspace } from "@/lib/auth/workspace";
import { dateInTz, parseDateRange } from "@/lib/dates";
import { listOrders } from "@/lib/db/queries/orders";
import { formatInteger, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const ATTRIBUTION_LABEL: Record<string, { label: string; help: string }> = {
  DIRECT_MATCH: { label: "Direct", help: "Matched by a direct identifier (e.g. click id)." },
  UTM_MATCH: { label: "UTM", help: "Matched by utm_campaign / utm_content on the order." },
  INFERRED: { label: "Inferred", help: "Estimated from timing and landing page. Lower confidence." },
  UNATTRIBUTED: { label: "Unattributed", help: "No reliable link to an ad. Not counted as ad-driven." },
};

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const ctx = await requireWorkspace();
  const params = await searchParams;
  const today = dateInTz(new Date(), ctx.workspace.timezone);
  const range = parseDateRange(params, today);
  const pageParam = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? Math.min(pageParam, 10_000) : 1;

  const { rows, total, pageCount } = await listOrders({
    workspaceId: ctx.workspace.id,
    timezone: ctx.workspace.timezone,
    from: range.from,
    to: range.to,
    page,
  });
  const cur = ctx.workspace.currency;

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "page") q.set(k, v);
    q.set("page", String(p));
    return `/orders?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${formatInteger(total, cur)} orders in the selected period. Costs are snapshotted at order time.`}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders in this period"
          description="Orders appear here once Shopify is connected, or when demo data is loaded."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Shipping</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="pr-4">Attribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const attr = ATTRIBUTION_LABEL[o.attributionMethod ?? "UNATTRIBUTED"];
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="pl-4 font-medium">
                        {o.orderNumber}
                        {o.isFirstOrder ? null : (
                          <Badge variant="outline" className="ml-2">
                            Returning
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                        {o.orderedAt.toLocaleString("en-GB", {
                          timeZone: ctx.workspace.timezone,
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="max-w-56 truncate" title={o.titles ?? undefined}>
                        {o.titles ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular">{formatMoney(o.totalRevenueCents, cur)}</TableCell>
                      <TableCell className={cn("text-right tabular", o.refundedCents > 0 && "text-negative")}>
                        {o.refundedCents > 0 ? `−${formatMoney(o.refundedCents, cur)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular">{formatMoney(o.cogsCents ?? 0, cur)}</TableCell>
                      <TableCell className="text-right tabular">{formatMoney(o.shippingCostCents, cur)}</TableCell>
                      <TableCell className="text-right tabular">
                        {formatMoney(o.paymentFeesCents, cur)}
                        {o.paymentFeesKind === "ESTIMATED" ? (
                          <span className="ml-1 text-xs text-muted-foreground" title="Estimated from finance settings">
                            est.
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="pr-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant={o.attributionMethod === "UNATTRIBUTED" ? "outline" : "secondary"}>
                              {attr.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {attr.help}
                            {o.campaignName ? ` Campaign: ${o.campaignName}.` : ""}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {pageCount > 1 ? (
        <nav className="mt-4 flex items-center justify-end gap-2 text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button asChild variant="outline" size="icon-sm" aria-disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
            <Link href={pageHref(page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm" aria-disabled={page >= pageCount} className={cn(page >= pageCount && "pointer-events-none opacity-50")}>
            <Link href={pageHref(page + 1)} aria-label="Next page">
              <ChevronRight />
            </Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
