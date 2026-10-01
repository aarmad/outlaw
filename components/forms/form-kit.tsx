"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation/action-state";

export function FormField({
  name,
  label,
  hint,
  state,
  className,
  addon,
  ...inputProps
}: ComponentProps<typeof Input> & {
  name: string;
  label: string;
  hint?: ReactNode;
  state?: ActionState;
  addon?: ReactNode;
}) {
  const errors = state?.fieldErrors?.[name];
  const id = inputProps.id ?? `field-${name}`;
  // After a failed submit, React resets the form to each input's defaultValue:
  // use the echoed value so the user does not lose what they typed.
  const echoed = state?.values?.[name];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          aria-invalid={errors ? true : undefined}
          aria-describedby={errors ? `${id}-error` : undefined}
          className={cn(addon && "pr-12")}
          {...inputProps}
          {...(echoed !== undefined && inputProps.value === undefined ? { defaultValue: echoed } : {})}
        />
        {addon ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {addon}
          </span>
        ) : null}
      </div>
      {errors ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {errors[0]}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.ok && state.message) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function SubmitButton({
  pending,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
