/**
 * Integration test: real migrations + real SQL aggregations against Postgres (PGlite,
 * exposed over the wire protocol so the production `postgres` driver is used).
 *
 * Expected values are computed independently from the in-memory demo dataset, so this
 * verifies that the SQL in lib/analytics returns exactly the same totals.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";

const PORT = 54_331;
const NOW = new Date("2026-10-01T15:00:00Z");
const TZ = "Europe/Paris";

let server: PGLiteSocketServer;
let sqlClient: ReturnType<typeof postgres>;

// Imported lazily, after the test database is wired in.
let mod: {
  createWorkspace: typeof import("@/lib/db/queries/workspaces").createWorkspace;
  ensureAppUser: typeof import("@/lib/db/queries/workspaces").ensureAppUser;
  seedDemoData: typeof import("@/lib/demo/seed").seedDemoData;
  clearDemoData: typeof import("@/lib/demo/seed").clearDemoData;
  queries: typeof import("@/lib/analytics/queries");
  getDashboardData: typeof import("@/lib/analytics/dashboard").getDashboardData;
  listOrders: typeof import("@/lib/db/queries/orders").listOrders;
};

beforeAll(async () => {
  const db = await PGlite.create();
  server = new PGLiteSocketServer({ db, port: PORT, maxConnections: 10 });
  await server.start();

  const url = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  process.env.DATABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test";

  sqlClient = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const testDb = drizzle(sqlClient, { schema });
  (globalThis as { __outlawDb?: unknown }).__outlawDb = testDb;
  await migrate(testDb, { migrationsFolder: "drizzle" });

  const ws = await import("@/lib/db/queries/workspaces");
  const seed = await import("@/lib/demo/seed");
  mod = {
    createWorkspace: ws.createWorkspace,
    ensureAppUser: ws.ensureAppUser,
    seedDemoData: seed.seedDemoData,
    clearDemoData: seed.clearDemoData,
    queries: await import("@/lib/analytics/queries"),
    getDashboardData: (await import("@/lib/analytics/dashboard")).getDashboardData,
    listOrders: (await import("@/lib/db/queries/orders")).listOrders,
  };
}, 60_000);

afterAll(async () => {
  await sqlClient?.end();
  await server?.stop();
});

async function newWorkspace(email: string) {
  const userId = crypto.randomUUID();
  await mod.ensureAppUser({ id: userId, email });
  return mod.createWorkspace({ ownerId: userId, name: "Test", currency: "EUR", timezone: TZ });
}

describe("demo seed + analytics SQL", () => {
  it("aggregates match the generated dataset exactly", async () => {
    const { generateDemoDataset } = await import("@/lib/demo/generator");
    const { DEFAULT_ASSUMPTIONS } = await import("@/lib/finance/assumptions");
    const { addDays, dateInTz } = await import("@/lib/dates");

    const ws = await newWorkspace("a@example.com");
    await mod.seedDemoData(ws.id, NOW);
    const expected = generateDemoDataset({
      workspaceId: ws.id,
      currency: "EUR",
      timezone: TZ,
      now: NOW,
      assumptions: DEFAULT_ASSUMPTIONS,
    });

    const today = dateInTz(NOW, TZ);
    const scope = { workspaceId: ws.id, timezone: TZ, from: addDays(today, -29), to: today };
    const sum = <T>(xs: T[], f: (x: T) => number | null | undefined) => xs.reduce((s, x) => s + (f(x) ?? 0), 0);

    const agg = await mod.queries.aggregateOrders(scope);
    expect(agg.orders).toBe(expected.orders.length);
    expect(agg.grossSalesCents).toBe(sum(expected.orders, (o) => o.subtotalCents));
    expect(agg.discountsCents).toBe(sum(expected.orders, (o) => o.discountsCents));
    expect(agg.refundsCents).toBe(sum(expected.refunds, (r) => r.amountCents));
    expect(agg.cogsCents).toBe(sum(expected.lineItems, (l) => l.cogsCents));
    expect(agg.shippingCostsCents).toBe(sum(expected.orders, (o) => o.shippingCostCents));
    expect(agg.paymentFeesCents).toBe(sum(expected.orders, (o) => o.paymentFeesCents));
    expect(agg.newCustomers).toBe(expected.orders.filter((o) => o.isFirstOrder).length);
    expect(agg.estimatedFeeOrders).toBe(expected.orders.length);

    const spend = await mod.queries.sumAdSpend(scope);
    expect(spend).toBe(sum(expected.insights, (i) => i.spendCents));

    const days = await mod.queries.dailySeries(scope);
    expect(days).toHaveLength(30);
    expect(sum(days, (d) => d.grossSalesCents)).toBe(agg.grossSalesCents);
    expect(sum(days, (d) => d.cogsCents)).toBe(agg.cogsCents);
    expect(sum(days, (d) => d.adSpendCents)).toBe(spend);

    const products = await mod.queries.productBreakdown(scope);
    expect(products).toHaveLength(3);
    expect(sum(products, (p) => p.adSpendCents)).toBe(spend);
    expect(sum(products, (p) => p.grossSalesCents)).toBe(agg.grossSalesCents);
    expect(sum(products, (p) => p.orders)).toBe(agg.orders);
    expect(sum(products, (p) => p.cogsCents)).toBe(agg.cogsCents);
  }, 60_000);

  it("dashboard profit equals the profit engine applied to independent totals", async () => {
    const { computeProfit } = await import("@/lib/finance/profit-engine");
    const ws = await newWorkspace("b@example.com");
    await mod.seedDemoData(ws.id, NOW);

    const data = await mod.getDashboardData({
      workspaceId: ws.id,
      timezone: TZ,
      range: { preset: "custom", from: "2026-09-02", to: "2026-10-01" },
      assumptions: { vatMode: "NONE", otherVariableCostBps: 0 },
    });
    const totals = await sqlClient<{ gross: string; disc: string; ref: string; ship: string; fees: string; n: string; first: string }[]>`
      select sum(subtotal_cents) gross, sum(discounts_cents) disc, sum(refunded_cents) ref,
             sum(shipping_cost_cents) ship, sum(payment_fees_cents) fees, count(*) n,
             count(*) filter (where is_first_order) first
      from orders where workspace_id = ${ws.id}`;
    const [{ cogs }] = await sqlClient<{ cogs: string }[]>`
      select sum(cogs_cents) cogs from order_line_items where workspace_id = ${ws.id}`;
    const [{ spend }] = await sqlClient<{ spend: string }[]>`
      select sum(spend_cents) spend from ad_insights_daily where workspace_id = ${ws.id}`;
    const t = totals[0];

    const expected = computeProfit({
      grossSalesCents: Number(t.gross),
      shippingRevenueCents: 0,
      discountsCents: Number(t.disc),
      refundsCents: Number(t.ref),
      cogsCents: Number(cogs),
      shippingCostsCents: Number(t.ship),
      paymentFeesCents: Number(t.fees),
      taxesCents: 0,
      adSpendCents: Number(spend),
      orders: Number(t.n),
      newCustomers: Number(t.first),
    });
    expect(data.current).toEqual(expected);
    expect(data.current.netProfitCents).toBeGreaterThan(0);
    expect(data.series).toHaveLength(30);
    expect(sum(data.series)).toBe(expected.netProfitCents);
    expect(data.unassignedSpendCents).toBe(0);

    function sum(xs: { profitCents: number }[]) {
      return xs.reduce((s, x) => s + x.profitCents, 0);
    }
  }, 60_000);

  it("re-seeding is idempotent and clearing removes only demo rows", async () => {
    const ws = await newWorkspace("c@example.com");
    const first = await mod.seedDemoData(ws.id, NOW);
    const second = await mod.seedDemoData(ws.id, NOW);
    const [{ n }] = await sqlClient<{ n: string }[]>`select count(*) n from orders where workspace_id = ${ws.id}`;
    expect(Number(n)).toBe(second.orders);
    expect(first.orders).toBe(second.orders);

    // A user-created product must survive clearing demo data.
    await sqlClient`insert into products (workspace_id, title, currency) values (${ws.id}, 'My own product', 'EUR')`;
    await mod.clearDemoData(ws.id);
    const [{ o }] = await sqlClient<{ o: string }[]>`select count(*) o from orders where workspace_id = ${ws.id}`;
    const titles = await sqlClient<{ title: string }[]>`select title from products where workspace_id = ${ws.id}`;
    expect(Number(o)).toBe(0);
    expect(titles.map((r) => r.title)).toEqual(["My own product"]);
  }, 60_000);

  it("isolates workspaces", async () => {
    const seeded = await newWorkspace("d@example.com");
    const other = await newWorkspace("e@example.com");
    await mod.seedDemoData(seeded.id, NOW);

    const scope = { workspaceId: other.id, timezone: TZ, from: "2026-09-02", to: "2026-10-01" };
    const agg = await mod.queries.aggregateOrders(scope);
    expect(agg.orders).toBe(0);
    expect(await mod.queries.sumAdSpend(scope)).toBe(0);
    expect(await mod.queries.productBreakdown(scope)).toHaveLength(0);
    const page = await mod.listOrders({ ...scope, page: 1 });
    expect(page.total).toBe(0);

    const own = await mod.listOrders({ ...scope, workspaceId: seeded.id, page: 1 });
    expect(own.rows.length).toBeGreaterThan(0);
    expect(own.rows[0].cogsCents).toBeGreaterThan(0);
  }, 60_000);
});
