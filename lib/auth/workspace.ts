import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { listMemberships, type MemberRole, type WorkspaceRow } from "@/lib/db/queries/workspaces";
import { requireUser, type SessionUser } from "./session";

export const ACTIVE_WORKSPACE_COOKIE = "outlaw_ws";

export interface WorkspaceContext {
  user: SessionUser;
  workspace: WorkspaceRow;
  role: MemberRole;
  workspaces: { id: string; name: string }[];
}

/**
 * Resolves the active workspace for the signed-in user. The workspace id from the cookie
 * is only a preference: it is honoured only if the user is a member. Every data access
 * must use `ctx.workspace.id` from here — never an id coming from the client.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) return null;

  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0];

  return {
    user,
    workspace: active.workspace,
    role: active.role,
    workspaces: memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name })),
  };
});

/** For app pages: redirects to onboarding until a workspace is fully set up. */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx || !ctx.workspace.onboardingCompletedAt) redirect("/onboarding");
  return ctx;
}

const ROLE_RANK: Record<MemberRole, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };

export function hasRole(ctx: WorkspaceContext, minimum: MemberRole): boolean {
  return ROLE_RANK[ctx.role] >= ROLE_RANK[minimum];
}
