"use client";

import { useActionState } from "react";
import { FormField, FormMessage, SubmitButton } from "@/components/forms/form-kit";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { initialActionState } from "@/lib/validation/action-state";
import { resetPasswordAction } from "../actions";

/** Reached from the recovery email via /auth/callback, which opens a recovery session. */
export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPasswordAction, initialActionState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>You will be signed in right after.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="grid gap-4">
          <FormMessage state={state} />
          <FormField
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            state={state}
          />
          <FormField
            name="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            state={state}
          />
        </CardContent>
        <CardFooter className="mt-6">
          <SubmitButton pending={pending} className="w-full">
            Update password
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
