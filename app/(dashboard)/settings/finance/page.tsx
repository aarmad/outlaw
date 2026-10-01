import type { Metadata } from "next";
import { hasRole, requireWorkspace } from "@/lib/auth/workspace";
import { getWorkspaceSettings } from "@/lib/db/queries/workspaces";
import { bpsToPercentString, centsToDecimalString } from "@/lib/finance/money";
import { FinanceSettingsForm } from "./finance-form";

export const metadata: Metadata = { title: "Finance settings" };

export default async function FinanceSettingsPage() {
  const ctx = await requireWorkspace();
  const s = await getWorkspaceSettings(ctx.workspace.id);

  return (
    <FinanceSettingsForm
      canEdit={hasRole(ctx, "ADMIN")}
      currency={ctx.workspace.currency}
      defaults={{
        paymentFeePercent: bpsToPercentString(s.paymentFeeBps),
        paymentFixedFee: centsToDecimalString(s.paymentFixedFeeCents),
        refundBufferPercent: bpsToPercentString(s.refundBufferBps),
        vatMode: s.vatMode,
        vatRatePercent: bpsToPercentString(s.vatRateBps),
        otherVariableCostPercent: bpsToPercentString(s.otherVariableCostBps),
        targetNetMarginPercent: bpsToPercentString(s.targetNetMarginBps),
        targetCpaBufferPercent: bpsToPercentString(s.targetCpaBufferBps),
        refundRateThresholdPercent: bpsToPercentString(s.refundRateThresholdBps),
        priceEndings: s.priceEndings.join(", "),
      }}
    />
  );
}
