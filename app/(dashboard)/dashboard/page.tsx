import { Info, Package, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProductProfitTable } from "@/components/dashboard/product-profit-table";
import { EmptyState, PageHeader } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/analytics/dashboard";
import { requireWorkspace } from "@/lib/auth/workspace";
import { dateInTz, parseDateRange } from "@/lib/dates";
import { getWorkspaceSettings } from "@/lib/db/queries/workspaces";
import { percentChange } from "@/lib/finance/ratios";
import { formatInteger, formatMoney, formatMultiple, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

function rangeLabel(from: string, to: string) {
  const f = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await requireWorkspace();
  const { workspace } = ctx;
  const today = dateInTz(new Date(), workspace.timezone);
  const range = parseDateRange(await searchParams, today);
  const settings = await getWorkspaceSettings(workspace.id);

  const data = await getDashboardData({
    workspaceId: workspace.id,
    timezone: workspace.timezone,
    range,
    assumptions: { vatMode: settings.vatMode, otherVariableCostBps: settings.otherVariableCostBps },
  });
  const { current: c, previous: p } = data;
  const cur = workspace.currency;
  const hasData = c.orders > 0 || c.adSpendCents > 0;
  const hasAnyProduct = data.products.length > 0;

  if (!hasData) {
    return (
      <>
        <PageHeader title="Dashboard" description={rangeLabel(range.from, range.to)} />
        <EmptyState
          icon={hasAnyProduct ? Info : Sparkles}
          title={hasAnyProduct ? "No orders or ad spend in this period" : "Nothing to analyse yet"}
          description={
            hasAnyProduct
              ? "Pick a wider date range, or check that your data is up to date."
              : "Load demo data to explore the dashboard, or add your first product and its costs."
          }
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/settings">Load demo data</Link>
              </Button>
              <Button asChild>
                <Link href="/products">
                  <Package /> Products
                </Link>
              </Button>
            </div>
          }
        />
      </>
    );
  }

  const ch = (a: number | null, b: number | null) => (a === null || b === null ? null : percentChange(a, b));
  const tone = (v: number) => (v > 0 ? "positive" : v < 0 ? "negative" : undefined);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <>
            {rangeLabel(range.from, range.to)}
            <span className="text-muted-foreground/70">
              {" "}
              · compared with {rangeLabel(data.previousRange.from, data.previousRange.to)}
            </span>
          </>
        }
      />

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard metric="revenue" value={formatMoney(c.netRevenueCents, cur)} change={ch(c.netRevenueCents, p.netRevenueCents)} />
        <KpiCard
          metric="adSpend"
          value={formatMoney(c.adSpendCents, cur)}
          change={ch(c.adSpendCents, p.adSpendCents)}
          polarity="neutral"
        />
        <KpiCard
          metric="netProfit"
          value={formatMoney(c.netProfitCents, cur)}
          change={ch(c.netProfitCents, p.netProfitCents)}
          tone={tone(c.netProfitCents)}
        />
        <KpiCard
          metric="netMargin"
          value={formatPercent(c.netMargin, { currency: cur })}
          change={ch(c.netMargin, p.netMargin)}
          emptyReason={c.netMargin === null ? "No revenue" : undefined}
        />
        <KpiCard
          metric="breakEvenCpa"
          value={formatMoney(c.breakEvenCpaCents, cur)}
          change={ch(c.breakEvenCpaCents, p.breakEvenCpaCents)}
          emptyReason={c.breakEvenCpaCents === null ? "No orders" : undefined}
        />
        <KpiCard
          metric="roas"
          value={formatMultiple(c.roas, cur)}
          change={ch(c.roas, p.roas)}
          emptyReason={c.roas === null ? "No ad spend" : undefined}
        />
        <KpiCard
          metric="poas"
          value={formatMultiple(c.poas, cur)}
          change={ch(c.poas, p.poas)}
          emptyReason={c.poas === null ? "No ad spend" : undefined}
        />
        <KpiCard
          metric="mer"
          value={formatMultiple(c.mer, cur)}
          change={ch(c.mer, p.mer)}
          emptyReason={c.mer === null ? "No ad spend" : undefined}
        />
        <KpiCard
          metric="orders"
          value={formatInteger(c.orders, cur)}
          change={ch(c.orders, p.orders)}
          footnote={c.aovCents !== null ? `AOV ${formatMoney(c.aovCents, cur)}` : undefined}
        />
        <KpiCard
          metric="cpa"
          value={formatMoney(c.cpaCents, cur)}
          change={ch(c.cpaCents, p.cpaCents)}
          polarity="up-bad"
          emptyReason={c.cpaCents === null ? "No new customers" : undefined}
        />
      </section>

      {data.quality.estimatedFeeOrders > 0 || data.quality.estimatedCogsLines > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5" />
          <span>
            Some figures are <span className="font-medium text-foreground">estimated</span> from your finance
            settings:{" "}
            {[
              data.quality.estimatedFeeOrders > 0 ? `payment fees on ${data.quality.estimatedFeeOrders} orders` : null,
              data.quality.estimatedCogsLines > 0 ? `COGS on ${data.quality.estimatedCogsLines} order lines` : null,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </span>
        </p>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Revenue, ad spend and profit</CardTitle>
          <CardDescription>Per day, in {workspace.timezone} time.</CardDescription>
        </CardHeader>
        <CardContent>
          <PerformanceChart data={data.series} currency={cur} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Profit by product</CardTitle>
          <CardDescription>
            Acquisition status compares CPA with break-even CPA, using your {settings.targetCpaBufferBps / 100}% safety
            buffer.
            {data.unassignedSpendCents > 0
              ? ` ${formatMoney(data.unassignedSpendCents, cur)} of ad spend is not linked to a product.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductProfitTable rows={data.products} currency={cur} cpaBufferBps={settings.targetCpaBufferBps} />
        </CardContent>
      </Card>
    </>
  );
}
