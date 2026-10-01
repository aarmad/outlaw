import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { integrations, stores } from "../schema";

/** Data shown in the app header for the active workspace. */
export async function getShellData(workspaceId: string) {
  const db = getDb();
  const [storeRows, integrationRows] = await Promise.all([
    db
      .select({ id: stores.id, name: stores.name, platform: stores.platform })
      .from(stores)
      .where(eq(stores.workspaceId, workspaceId))
      .orderBy(asc(stores.createdAt)),
    db
      .select({
        provider: integrations.provider,
        status: integrations.status,
        lastSuccessfulSyncAt: integrations.lastSuccessfulSyncAt,
      })
      .from(integrations)
      .where(eq(integrations.workspaceId, workspaceId)),
  ]);

  const connected = integrationRows.filter((i) => i.status === "CONNECTED" || i.status === "SYNCING");
  const lastSync = integrationRows
    .map((i) => i.lastSuccessfulSyncAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    stores: storeRows,
    hasSyncableIntegration: connected.length > 0,
    lastSyncAt: lastSync?.toISOString() ?? null,
  };
}
