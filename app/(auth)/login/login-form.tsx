"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField, FormMessage, SubmitButton } from "@/components/forms/form-kit";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { initialActionState } from "@/lib/validation/action-state";
import { signInAction } from "../actions";

export function LoginForm({ next, linkError }: { next?: string; linkError?: string }) {
  const [state, action, pending] = useActionState(signInAction, initialActionState);
  const shown = state.error || state.ok ? state : linkError ? { error: linkError } : state;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back. Enter your credentials to continue.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="grid gap-4">
          <FormMessage state={shown} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <FormField name="email" label="Email" type="email" autoComplete="email" required state={state} />
          <div className="grid gap-1.5">
            <FormField
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              state={state}
            />
            <Link href="/forgot-password" className="justify-self-end text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <SubmitButton pending={pending} className="w-full">
            Sign in
          </SubmitButton>
          <p className="text-sm text-muted-foreground">
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
