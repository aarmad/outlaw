"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField, FormMessage, SubmitButton } from "@/components/forms/form-kit";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { initialActionState } from "@/lib/validation/action-state";
import { signUpAction } from "../actions";

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUpAction, initialActionState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Start with demo data, connect your store later.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="grid gap-4">
          <FormMessage state={state} />
          <FormField name="fullName" label="Full name" autoComplete="name" state={state} />
          <FormField name="email" label="Email" type="email" autoComplete="email" required state={state} />
          <FormField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            state={state}
          />
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <SubmitButton pending={pending} className="w-full" disabled={state.ok}>
            Create account
          </SubmitButton>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
