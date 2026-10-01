"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext, hasRole } from "@/lib/auth/workspace";
import { updateWorkspace, updateWorkspaceSettings } from "@/lib/db/queries/workspaces";
import { clearDemoData, seedDemoData } from "@/lib/demo/seed";
import { fieldErrorsFrom, submittedValues, type ActionState } from "@/lib/validation/action-state";
import { financeSettingsSchema } from "@/lib/validation/settings";
import { workspaceGeneralSchema } from "@/lib/validation/workspace";

const FORBIDDEN: ActionState = { error: "Only workspace owners and admins can change settings." };
const FAILED: ActionState = { error: "Your changes could not be saved. Please try again." };

/** Resolves the caller's workspace server-side; the client never chooses which workspace it edits. */
async function requireAdmin() {
  const ctx = await getWorkspaceContext();
  if (!ctx || !hasRole(ctx, "ADMIN")) return null;
  return ctx;
}

export async function updateGeneralSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  if (!ctx) return FORBIDDEN;
  const parsed = workspaceGeneralSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  try {
    await updateWorkspace(ctx.workspace.id, parsed.data);
  } catch {
    return { ...FAILED, values: submittedValues(formData) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Workspace settings saved." };
}

export async function updateFinanceSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  if (!ctx) return FORBIDDEN;
  const parsed = financeSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);
  const v = parsed.data;

  try {
    await updateWorkspaceSettings(ctx.workspace.id, {
      paymentFeeBps: v.paymentFeePercent,
      paymentFixedFeeCents: v.paymentFixedFee,
      refundBufferBps: v.refundBufferPercent,
      vatMode: v.vatMode,
      vatRateBps: v.vatRatePercent,
      otherVariableCostBps: v.otherVariableCostPercent,
      targetNetMarginBps: v.targetNetMarginPercent,
      targetCpaBufferBps: v.targetCpaBufferPercent,
      refundRateThresholdBps: v.refundRateThresholdPercent,
      priceEndings: v.priceEndings,
    });
  } catch {
    return { ...FAILED, values: submittedValues(formData) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Finance settings saved. Simulations now use these assumptions." };
}

export async function loadDemoDataAction(): Promise<ActionState> {
  const ctx = await requireAdmin();
  if (!ctx) return FORBIDDEN;
  try {
    const result = await seedDemoData(ctx.workspace.id);
    revalidatePath("/", "layout");
    return { ok: true, message: `Demo data loaded: ${result.orders} orders over the last 30 days.` };
  } catch (error) {
    console.error("[demo] seed failed", error instanceof Error ? error.message : "unknown");
    return { error: "Demo data could not be loaded. Please try again." };
  }
}

export async function clearDemoDataAction(): Promise<ActionState> {
  const ctx = await requireAdmin();
  if (!ctx) return FORBIDDEN;
  try {
    await clearDemoData(ctx.workspace.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Demo data removed. Your own data was not touched." };
  } catch (error) {
    console.error("[demo] clear failed", error instanceof Error ? error.message : "unknown");
    return { error: "Demo data could not be removed. Please try again." };
  }
}
