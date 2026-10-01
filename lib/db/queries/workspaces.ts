import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { users, workspaceMembers, workspaceSettings, workspaces } from "../schema";

export type MemberRole = (typeof workspaceMembers.$inferSelect)["role"];
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type WorkspaceSettingsRow = typeof workspaceSettings.$inferSelect;

/** Mirrors the Supabase auth user into our `users` table. Idempotent. */
export async function ensureAppUser(user: { id: string; email: string }) {
  await getDb()
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}

export async function listMemberships(userId: string) {
  return getDb()
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt));
}

export async function createWorkspace(input: {
  ownerId: string;
  name: string;
  currency: string;
  timezone: string;
}) {
  return getDb().transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspaces)
      .values({ name: input.name, currency: input.currency, timezone: input.timezone })
      .returning();
    await tx.insert(workspaceMembers).values({ workspaceId: ws.id, userId: input.ownerId, role: "OWNER" });
    await tx.insert(workspaceSettings).values({ workspaceId: ws.id });
    return ws;
  });
}

export async function updateWorkspace(
  workspaceId: string,
  patch: Partial<Pick<WorkspaceRow, "name" | "currency" | "timezone" | "demoMode" | "onboardingCompletedAt">>,
) {
  await getDb().update(workspaces).set(patch).where(eq(workspaces.id, workspaceId));
}

export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsRow> {
  const db = getDb();
  const [row] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId));
  if (row) return row;
  const [created] = await db
    .insert(workspaceSettings)
    .values({ workspaceId })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId)))[0];
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  patch: Partial<Omit<WorkspaceSettingsRow, "workspaceId" | "updatedAt">>,
) {
  await getDb()
    .update(workspaceSettings)
    .set(patch)
    .where(eq(workspaceSettings.workspaceId, workspaceId));
}
