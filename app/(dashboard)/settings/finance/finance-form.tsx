"use client";

import { useActionState, useState } from "react";
import { FormField, FormMessage, SubmitButton } from "@/components/forms/form-kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/validation/action-state";
import { updateFinanceSettingsAction } from "../actions";

type Defaults = Record<
  | "paymentFeePercent"
  | "paymentFixedFee"
  | "refundBufferPercent"
  | "vatRatePercent"
  | "otherVariableCostPercent"
  | "targetNetMarginPercent"
  | "targetCpaBufferPercent"
  | "refundRateThresholdPercent"
  | "priceEndings",
  string
> & { vatMode: "NONE" | "INCLUDED" };

export function FinanceSettingsForm({
  canEdit,
  currency,
  defaults,
}: {
  canEdit: boolean;
  currency: string;
  defaults: Defaults;
}) {
  const [state, action, pending] = useActionState(updateFinanceSettingsAction, initialActionState);
  const [vatMode, setVatMode] = useState(defaults.vatMode);
  const common = { state, disabled: !canEdit, inputMode: "decimal" as const };

  return (
    <form action={action} className="grid gap-6">
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Costs per order <Badge variant="outline">Estimated</Badge>
          </CardTitle>
          <CardDescription>
            Used for simulations and whenever the real value is unknown. Real values from your store always win and are
            labelled <span className="font-medium text-foreground">Actual</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6 grid gap-4 sm:grid-cols-2">
          <FormField name="paymentFeePercent" label="Payment fee" addon="%" defaultValue={defaults.paymentFeePercent} hint="e.g. 2.9 for Shopify Payments." {...common} />
          <FormField name="paymentFixedFee" label="Payment fixed fee" addon={currency} defaultValue={defaults.paymentFixedFee} hint="Per transaction, e.g. 0.30." {...common} />
          <FormField name="otherVariableCostPercent" label="Other variable costs" addon="%" defaultValue={defaults.otherVariableCostPercent} hint="Apps, chargebacks… as a share of revenue." {...common} />
          <FormField name="refundBufferPercent" label="Refund buffer" addon="%" defaultValue={defaults.refundBufferPercent} hint="Expected refunds, used in offer simulations only." {...common} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxes</CardTitle>
          <CardDescription>
            If your prices include VAT, the VAT part is removed from revenue before computing profit.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>VAT mode</Label>
            <input type="hidden" name="vatMode" value={vatMode} />
            <Select value={vatMode} onValueChange={(v) => setVatMode(v as Defaults["vatMode"])} disabled={!canEdit}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No VAT handling</SelectItem>
                <SelectItem value="INCLUDED">Prices include VAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <FormField name="vatRatePercent" label="VAT rate" addon="%" defaultValue={defaults.vatRatePercent} {...common} disabled={!canEdit || vatMode === "NONE"} />
          {vatMode === "NONE" ? <input type="hidden" name="vatRatePercent" value={defaults.vatRatePercent} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Targets</CardTitle>
          <CardDescription>Thresholds used to judge whether products, offers and campaigns are healthy.</CardDescription>
        </CardHeader>
        <CardContent className="mt-6 grid gap-4 sm:grid-cols-2">
          <FormField name="targetNetMarginPercent" label="Target net margin" addon="%" defaultValue={defaults.targetNetMarginPercent} {...common} />
          <FormField name="targetCpaBufferPercent" label="CPA safety buffer" addon="%" defaultValue={defaults.targetCpaBufferPercent} hint="CPA within this % of break-even is flagged as thin." {...common} />
          <FormField name="refundRateThresholdPercent" label="Refund rate alert" addon="%" defaultValue={defaults.refundRateThresholdPercent} {...common} />
          <FormField name="priceEndings" label="Price endings" defaultValue={defaults.priceEndings} hint="Cents used by the offer generator, e.g. 90, 95, 99." state={state} disabled={!canEdit} />
        </CardContent>
        <CardFooter className="mt-6 justify-end">
          <SubmitButton pending={pending} disabled={!canEdit}>
            Save finance settings
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
