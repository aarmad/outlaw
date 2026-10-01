import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { addDays, zonedTimeToUtc, type IsoDate } from "@/lib/dates";

/**
 * Raw aggregations. Everything is summed in Postgres; no business formula lives here —
 * results are fed to lib/finance/profit-engine.
 *
 * Accounting conventions (documented in docs/ARCHITECTURE.md):
 * - Orders are bucketed by ORDER date in the workspace timezone.
 * - Refunds are attached to the original order's date (cohort view), so a product's
 *   profit for a period reflects the orders acquired in that period.
 * - Ad spend uses the ad-account reporting date.
 * - Cancelled orders are excluded.
 */

export interface Scope {
  workspaceId: string;
  timezone: string;
  from: IsoDate;
  to: IsoDate;
}

function utcBounds(scope: Scope) {
  return {
    start: zonedTimeToUtc(scope.from, 0, 0, scope.timezone).toISOString(),
    end: zonedTimeToUtc(addDays(scope.to, 1), 0, 0, scope.timezone).toISOString(),
  };
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export interface OrderAggregate {
  grossSalesCents: number;
  shippingRevenueCents: number;
  discountsCents: number;
  refundsCents: number;
  taxCents: number;
  shippingCostsCents: number;
  paymentFeesCents: number;
  estimatedFeeOrders: number;
  cogsCents: number;
  estimatedCogsLines: number;
  orders: number;
  newCustomers: number;
}

export async function aggregateOrders(scope: Scope): Promise<OrderAggregate> {
  const { start, end } = utcBounds(scope);
  const rows = await getDb().execute(sql`
    with o as (
      select * from orders
      where workspace_id = ${scope.workspaceId}
        and ordered_at >= ${start} and ordered_at < ${end}
        and cancelled_at is null
    ),
    li as (
      select coalesce(sum(l.cogs_cents), 0) as cogs,
             count(*) filter (where l.cogs_kind = 'ESTIMATED') as estimated_cogs_lines
      from order_line_items l join o on o.id = l.order_id
    )
    select
      coalesce(sum(o.subtotal_cents), 0)          as gross_sales,
      coalesce(sum(o.shipping_revenue_cents), 0)  as shipping_revenue,
      coalesce(sum(o.discounts_cents), 0)         as discounts,
      coalesce(sum(o.refunded_cents), 0)          as refunds,
      coalesce(sum(o.tax_cents), 0)               as tax,
      coalesce(sum(o.shipping_cost_cents), 0)     as shipping_costs,
      coalesce(sum(o.payment_fees_cents), 0)      as payment_fees,
      count(*) filter (where o.payment_fees_kind = 'ESTIMATED') as estimated_fee_orders,
      count(*)                                    as orders,
      count(*) filter (where o.is_first_order)    as new_customers,
      (select cogs from li)                       as cogs,
      (select estimated_cogs_lines from li)       as estimated_cogs_lines
    from o
  `);
  const r = rows[0] ?? {};
  return {
    grossSalesCents: n(r.gross_sales),
    shippingRevenueCents: n(r.shipping_revenue),
    discountsCents: n(r.discounts),
    refundsCents: n(r.refunds),
    taxCents: n(r.tax),
    shippingCostsCents: n(r.shipping_costs),
    paymentFeesCents: n(r.payment_fees),
    estimatedFeeOrders: n(r.estimated_fee_orders),
    cogsCents: n(r.cogs),
    estimatedCogsLines: n(r.estimated_cogs_lines),
    orders: n(r.orders),
    newCustomers: n(r.new_customers),
  };
}

export async function sumAdSpend(scope: Scope): Promise<number> {
  const rows = await getDb().execute(sql`
    select coalesce(sum(spend_cents), 0) as spend
    from ad_insights_daily
    where workspace_id = ${scope.workspaceId} and date between ${scope.from} and ${scope.to}
  `);
  return n(rows[0]?.spend);
}

export interface DailyRow extends Omit<OrderAggregate, "estimatedFeeOrders" | "estimatedCogsLines"> {
  date: IsoDate;
  adSpendCents: number;
}

export async function dailySeries(scope: Scope): Promise<DailyRow[]> {
  const { start, end } = utcBounds(scope);
  const rows = await getDb().execute(sql`
    with days as (
      select d::date as day
      from generate_series(${scope.from}::date, ${scope.to}::date, interval '1 day') d
    ),
    o as (
      select (ordered_at at time zone ${scope.timezone})::date as day, *
      from orders
      where workspace_id = ${scope.workspaceId}
        and ordered_at >= ${start} and ordered_at < ${end}
        and cancelled_at is null
    ),
    od as (
      select day,
        sum(subtotal_cents) gross_sales, sum(shipping_revenue_cents) shipping_revenue,
        sum(discounts_cents) discounts, sum(refunded_cents) refunds, sum(tax_cents) tax,
        sum(shipping_cost_cents) shipping_costs, sum(payment_fees_cents) payment_fees,
        count(*) orders, count(*) filter (where is_first_order) new_customers
      from o group by day
    ),
    ld as (
      select o.day, sum(l.cogs_cents) cogs
      from order_line_items l join o on o.id = l.order_id
      group by o.day
    ),
    sd as (
      select date as day, sum(spend_cents) spend
      from ad_insights_daily
      where workspace_id = ${scope.workspaceId} and date between ${scope.from} and ${scope.to}
      group by date
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      od.gross_sales, od.shipping_revenue, od.discounts, od.refunds, od.tax,
      od.shipping_costs, od.payment_fees, od.orders, od.new_customers,
      ld.cogs, sd.spend
    from days
    left join od on od.day = days.day
    left join ld on ld.day = days.day
    left join sd on sd.day = days.day
    order by days.day
  `);
  return rows.map((r) => ({
    date: String(r.day),
    grossSalesCents: n(r.gross_sales),
    shippingRevenueCents: n(r.shipping_revenue),
    discountsCents: n(r.discounts),
    refundsCents: n(r.refunds),
    taxCents: n(r.tax),
    shippingCostsCents: n(r.shipping_costs),
    paymentFeesCents: n(r.payment_fees),
    cogsCents: n(r.cogs),
    orders: n(r.orders),
    newCustomers: n(r.new_customers),
    adSpendCents: n(r.spend),
  }));
}

export interface ProductRow extends Omit<OrderAggregate, "estimatedFeeOrders" | "estimatedCogsLines"> {
  productId: string;
  title: string;
  imageUrl: string | null;
  adSpendCents: number;
}

/**
 * Per-product aggregates. Order-level amounts (subtotal, shipping, fees, refunds, tax,
 * shipping revenue) are allocated to lines pro rata of line gross value. With several
 * products in one order, per-product sums can differ from the order total by rounding
 * (at most one cent per product per order). Ad spend is mapped via
 * ad.product_id, falling back to campaign.product_id.
 */
export async function productBreakdown(scope: Scope): Promise<ProductRow[]> {
  const { start, end } = utcBounds(scope);
  const rows = await getDb().execute(sql`
    with o as (
      select * from orders
      where workspace_id = ${scope.workspaceId}
        and ordered_at >= ${start} and ordered_at < ${end}
        and cancelled_at is null
    ),
    raw_lines as (
      select l.product_id, o.id as order_id, o.is_first_order,
        (l.unit_price_cents * l.quantity)::numeric as line_gross,
        sum(l.unit_price_cents * l.quantity) over (partition by o.id) as order_lines_gross,
        l.discount_cents, l.cogs_cents,
        o.subtotal_cents, o.refunded_cents, o.shipping_cost_cents, o.payment_fees_cents,
        o.tax_cents, o.shipping_revenue_cents
      from order_line_items l join o on o.id = l.order_id
    ),
    lines as (
      -- Share of the order each line represents. The order subtotal (not rounded unit
      -- prices × quantity) is the source of truth, so bundle rounding never leaks in.
      select *, case when order_lines_gross > 0 then line_gross / order_lines_gross else 0 end as share
      from raw_lines
      where product_id is not null
    ),
    sales as (
      select product_id,
        round(sum(subtotal_cents * share)) gross_sales,
        sum(discount_cents) discounts,
        sum(cogs_cents) cogs,
        round(sum(refunded_cents * share)) refunds,
        round(sum(shipping_cost_cents * share)) shipping_costs,
        round(sum(payment_fees_cents * share)) payment_fees,
        round(sum(tax_cents * share)) tax,
        round(sum(shipping_revenue_cents * share)) shipping_revenue,
        count(distinct order_id) orders,
        count(distinct order_id) filter (where is_first_order) new_customers
      from lines group by product_id
    ),
    spend as (
      select coalesce(a.product_id, c.product_id) as product_id, sum(i.spend_cents) spend
      from ad_insights_daily i
      join ads a on a.id = i.ad_id
      join campaigns c on c.id = a.campaign_id
      where i.workspace_id = ${scope.workspaceId} and i.date between ${scope.from} and ${scope.to}
      group by 1
    )
    select p.id, p.title, p.image_url, s.*, sp.spend
    from products p
    left join sales s on s.product_id = p.id
    left join spend sp on sp.product_id = p.id
    where p.workspace_id = ${scope.workspaceId} and p.status <> 'ARCHIVED'
    order by coalesce(s.gross_sales, 0) desc, p.title
  `);
  return rows.map((r) => ({
    productId: String(r.id),
    title: String(r.title),
    imageUrl: (r.image_url as string | null) ?? null,
    grossSalesCents: n(r.gross_sales),
    shippingRevenueCents: n(r.shipping_revenue),
    discountsCents: n(r.discounts),
    refundsCents: n(r.refunds),
    taxCents: n(r.tax),
    shippingCostsCents: n(r.shipping_costs),
    paymentFeesCents: n(r.payment_fees),
    cogsCents: n(r.cogs),
    orders: n(r.orders),
    newCustomers: n(r.new_customers),
    adSpendCents: n(r.spend),
  }));
}
