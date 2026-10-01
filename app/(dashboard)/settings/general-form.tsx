"use client";

import { useActionState, useState } from "react";
import { FormField, FormMessage, SubmitButton } from "@/components/forms/form-kit";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_CURRENCIES } from "@/lib/format";
import { initialActionState } from "@/lib/validation/action-state";
import { updateGeneralSettingsAction } from "./actions";

export function GeneralSettingsForm({
  canEdit,
  defaults,
}: {
  canEdit: boolean;
  defaults: { name: string; currency: string; timezone: string };
}) {
  const [state, action, pending] = useActionState(updateGeneralSettingsAction, initialActionState);
  const [currency, setCurrency] = useState(defaults.currency);

  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Reporting currency and the timezone used to cut days.</CardDescription>
        </CardHeader>
        <CardContent className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormMessage state={state} />
          </div>
          <FormField name="name" label="Workspace name" defaultValue={defaults.name} disabled={!canEdit} state={state} />
          <div className="grid gap-1.5">
            <Label>Currency</Label>
            <input type="hidden" name="currency" value={currency} />
            <Select value={currency} onValueChange={setCurrency} disabled={!canEdit}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Amounts are not converted. Multi-currency stores are not supported yet.
            </p>
          </div>
          <FormField
            name="timezone"
            label="Timezone"
            defaultValue={defaults.timezone}
            disabled={!canEdit}
            hint="IANA name, e.g. Europe/Paris."
            state={state}
          />
        </CardContent>
        <CardFooter className="mt-6 justify-end">
          <SubmitButton pending={pending} disabled={!canEdit}>
            Save
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
