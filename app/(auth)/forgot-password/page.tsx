"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField, FormMessage, SubmitButton } from "@/components/forms/form-kit";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { initialActionState } from "@/lib/validation/action-state";
import { forgotPasswordAction } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialActionState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>We will email you a secure link to choose a new password.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="grid gap-4">
          <FormMessage state={state} />
          <FormField name="email" label="Email" type="email" autoComplete="email" required state={state} />
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <SubmitButton pending={pending} className="w-full" disabled={state.ok}>
            Send reset link
          </SubmitButton>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
