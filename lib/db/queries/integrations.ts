import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { integrations } from "../schema";

/** Integration status for display. Token columns are deliberately never selected. */
export async function listIntegrationStatuses(workspaceId: string) {
  return getDb()
    .select({
      provider: integrations.provider,
      status: integrations.status,
      accountName: integrations.accountName,
      lastSyncAt: integrations.lastSyncAt,
      lastSuccessfulSyncAt: integrations.lastSuccessfulSyncAt,
      lastError: integrations.lastError,
    })
    .from(integrations)
    .where(eq(integrations.workspaceId, workspaceId));
}
