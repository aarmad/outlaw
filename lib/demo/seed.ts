import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db/client";
import {
  adAccounts,
  adInsightsDaily,
  adSets,
  ads,
  attributions,
  campaigns,
  offerTiers,
  offers,
  orderLineItems,
  orders,
  productCostHistory,
  products,
  refunds,
  stores,
  workspaceSettings,
  workspaces,
} from "@/lib/db/schema";
import type { FinanceAssumptions } from "@/lib/finance/assumptions";
import { DEMO_AD_ACCOUNT_EXTERNAL_ID, DEMO_STORE_EXTERNAL_ID, generateDemoDataset } from "./generator";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const CHUNK = 500;

async function insertChunked<T extends Record<string, unknown>>(
  tx: Tx,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  rows: T[],
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await tx.insert(table).values(rows.slice(i, i + CHUNK));
  }
}

/** Removes only demo rows (demo store, its products, demo ad account). Real data is untouched. */
async function deleteDemoRows(tx: Tx, workspaceId: string) {
  const demoStores = await tx
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.workspaceId, workspaceId), eq(stores.platform, "DEMO")));
  const storeIds = demoStores.map((s) => s.id);
  if (storeIds.length > 0) {
    // Products only SET NULL on store deletion, so delete demo products explicitly.
    await tx.delete(products).where(and(eq(products.workspaceId, workspaceId), inArray(products.storeId, storeIds)));
    await tx.delete(stores).where(inArray(stores.id, storeIds));
  }
  await tx
    .delete(adAccounts)
    .where(and(eq(adAccounts.workspaceId, workspaceId), eq(adAccounts.externalId, DEMO_AD_ACCOUNT_EXTERNAL_ID)));
}

/**
 * (Re)seeds the demo dataset for a workspace, anchored on "now" so the dashboard is
 * always populated. Runs in one transaction: either all demo rows exist or none do.
 */
export async function seedDemoData(workspaceId: string, now = new Date()) {
  const db = getDb();
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws) throw new Error("Workspace not found");
  const [settings] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId));

  const assumptions: FinanceAssumptions = {
    paymentFeeBps: settings?.paymentFeeBps ?? 290,
    paymentFixedFeeCents: settings?.paymentFixedFeeCents ?? 30,
    refundBufferBps: settings?.refundBufferBps ?? 300,
    vatMode: settings?.vatMode ?? "NONE",
    vatRateBps: settings?.vatRateBps ?? 2000,
    otherVariableCostBps: settings?.otherVariableCostBps ?? 0,
  };

  const data = generateDemoDataset({
    workspaceId,
    currency: ws.currency,
    timezone: ws.timezone,
    now,
    assumptions,
  });

  await db.transaction(async (tx) => {
    await deleteDemoRows(tx, workspaceId);
    await tx.insert(stores).values(data.store);
    await tx.insert(adAccounts).values(data.adAccount);
    await insertChunked(tx, products, data.products);
    await insertChunked(tx, productCostHistory, data.costHistory);
    await insertChunked(tx, offers, data.offers);
    await insertChunked(tx, offerTiers, data.offerTiers);
    await insertChunked(tx, campaigns, data.campaigns);
    await insertChunked(tx, adSets, data.adSets);
    await insertChunked(tx, ads, data.ads);
    await insertChunked(tx, adInsightsDaily, data.insights);
    await insertChunked(tx, orders, data.orders);
    await insertChunked(tx, orderLineItems, data.lineItems);
    await insertChunked(tx, refunds, data.refunds);
    await insertChunked(tx, attributions, data.attributions);
    await tx.update(workspaces).set({ demoMode: true, demoSeededAt: now }).where(eq(workspaces.id, workspaceId));
  });

  return { orders: data.orders.length, ads: data.ads.length };
}

export async function clearDemoData(workspaceId: string) {
  await getDb().transaction(async (tx) => {
    await deleteDemoRows(tx, workspaceId);
    await tx.update(workspaces).set({ demoMode: false, demoSeededAt: null }).where(eq(workspaces.id, workspaceId));
  });
}

/** Exposed for tests and the README: the external ids that mark demo rows. */
export const DEMO_MARKERS = { store: DEMO_STORE_EXTERNAL_ID, adAccount: DEMO_AD_ACCOUNT_EXTERNAL_ID };
