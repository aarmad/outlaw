"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_WORKSPACE_COOKIE, getWorkspaceContext } from "@/lib/auth/workspace";
import { requireUser } from "@/lib/auth/session";
import { createWorkspace, ensureAppUser, updateWorkspace } from "@/lib/db/queries/workspaces";
import { seedDemoData } from "@/lib/demo/seed";
import { fieldErrorsFrom, type ActionState } from "@/lib/validation/action-state";
import { onboardingSchema } from "@/lib/validation/workspace";

export async function completeOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const { name, currency, timezone, dataMode } = parsed.data;

  try {
    await ensureAppUser(user);
    const existing = await getWorkspaceContext();
    let workspaceId: string;
    if (existing) {
      workspaceId = existing.workspace.id;
      await updateWorkspace(workspaceId, { name, currency, timezone });
    } else {
      workspaceId = (await createWorkspace({ ownerId: user.id, name, currency, timezone })).id;
    }

    if (dataMode === "demo") await seedDemoData(workspaceId);
    await updateWorkspace(workspaceId, { onboardingCompletedAt: new Date() });

    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (error) {
    console.error("[onboarding] failed", error instanceof Error ? error.message : "unknown error");
    return { error: "We could not set up your workspace. Please try again." };
  }

  redirect("/dashboard");
}
