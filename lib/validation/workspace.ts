import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/format";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(80, "Use at most 80 characters.");

export const onboardingSchema = z.object({
  name: workspaceNameSchema,
  currency: z.enum(SUPPORTED_CURRENCIES),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone."),
  dataMode: z.enum(["demo", "empty"]),
});

export const workspaceGeneralSchema = z.object({
  name: workspaceNameSchema,
  currency: z.enum(SUPPORTED_CURRENCIES),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone."),
});
