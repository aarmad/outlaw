import "server-only";
import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { addDays, zonedTimeToUtc, type IsoDate } from "@/lib/dates";
import { getDb } from "../client";
import { attributions, campaigns, orderLineItems, orders } from "../schema";

export const ORDERS_PAGE_SIZE = 50;

export async function listOrders(input: {
  workspaceId: string;
  timezone: string;
  from: IsoDate;
  to: IsoDate;
  page: number;
}) {
  const db = getDb();
  const start = zonedTimeToUtc(input.from, 0, 0, input.timezone);
  const end = zonedTimeToUtc(addDays(input.to, 1), 0, 0, input.timezone);
  const where = and(
    eq(orders.workspaceId, input.workspaceId),
    gte(orders.orderedAt, start),
    lt(orders.orderedAt, end),
    isNull(orders.cancelledAt),
  );

  // COGS per order is pre-aggregated in a subquery to avoid N+1 lookups.
  const cogs = db
    .select({
      orderId: orderLineItems.orderId,
      cogsCents: sql<number>`sum(${orderLineItems.cogsCents})`.mapWith(Number).as("cogs_cents"),
      items: sql<number>`sum(${orderLineItems.quantity})`.mapWith(Number).as("items"),
      titles: sql<string>`string_agg(${orderLineItems.title}, ', ')`.as("titles"),
    })
    .from(orderLineItems)
    .where(eq(orderLineItems.workspaceId, input.workspaceId))
    .groupBy(orderLineItems.orderId)
    .as("cogs");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderedAt: orders.orderedAt,
        currency: orders.currency,
        totalRevenueCents: orders.totalRevenueCents,
        discountsCents: orders.discountsCents,
        refundedCents: orders.refundedCents,
        shippingCostCents: orders.shippingCostCents,
        paymentFeesCents: orders.paymentFeesCents,
        paymentFeesKind: orders.paymentFeesKind,
        isFirstOrder: orders.isFirstOrder,
        cogsCents: cogs.cogsCents,
        items: cogs.items,
        titles: cogs.titles,
        attributionMethod: attributions.method,
        campaignName: campaigns.name,
      })
      .from(orders)
      .leftJoin(cogs, eq(cogs.orderId, orders.id))
      .leftJoin(attributions, eq(attributions.orderId, orders.id))
      .leftJoin(campaigns, eq(campaigns.id, attributions.campaignId))
      .where(where)
      .orderBy(desc(orders.orderedAt))
      .limit(ORDERS_PAGE_SIZE)
      .offset((input.page - 1) * ORDERS_PAGE_SIZE),
    db.select({ total: count() }).from(orders).where(where),
  ]);

  return { rows, total, pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)) };
}
