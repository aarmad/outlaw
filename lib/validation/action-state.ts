import type { z } from "zod";

/** Uniform result shape for form Server Actions (consumed with useActionState). */
export interface ActionState {
  ok?: boolean;
  /** User-facing, non-technical message. Never a stack trace or a raw provider error. */
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /**
   * Submitted values echoed back so fields keep their content after React resets the
   * form. Secrets (passwords) are never included.
   */
  values?: Record<string, string>;
}

const NEVER_ECHO = /password/i;

export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !NEVER_ECHO.test(key) && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

export const initialActionState: ActionState = {};

export function fieldErrorsFrom(error: z.ZodError, formData?: FormData): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    error: "Please check the highlighted fields.",
    fieldErrors,
    values: formData ? submittedValues(formData) : undefined,
  };
}
