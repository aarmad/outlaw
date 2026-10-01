import type { Metadata } from "next";
import { hasRole, requireWorkspace } from "@/lib/auth/workspace";
import { DemoDataCard } from "./demo-data-card";
import { GeneralSettingsForm } from "./general-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireWorkspace();
  const canEdit = hasRole(ctx, "ADMIN");
  return (
    <div className="grid gap-6">
      <GeneralSettingsForm
        canEdit={canEdit}
        defaults={{ name: ctx.workspace.name, currency: ctx.workspace.currency, timezone: ctx.workspace.timezone }}
      />
      <DemoDataCard
        canEdit={canEdit}
        demoMode={ctx.workspace.demoMode}
        seededAt={ctx.workspace.demoSeededAt?.toISOString() ?? null}
      />
    </div>
  );
}
