import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated lazily on first access so that `next build`
 * does not require production secrets to be present.
 *
 * Never import this module from a client component: `server-only` will fail the build.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** 32 random bytes, base64-encoded. Used to encrypt OAuth tokens at rest. */
  ENCRYPTION_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    // Only variable names are reported, never values.
    throw new Error(`Invalid or missing environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
