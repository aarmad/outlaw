import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * One connection pool per serverless instance (and per dev-server HMR cycle).
 * `prepare: false` keeps us compatible with Supabase's transaction pooler (port 6543),
 * which is what serverless functions should use.
 */
const globalForDb = globalThis as unknown as { __outlawDb?: Database };

export function getDb(): Database {
  if (!globalForDb.__outlawDb) {
    const client = postgres(serverEnv().DATABASE_URL, {
      prepare: false,
      max: process.env.NODE_ENV === "production" ? 5 : 10,
      idle_timeout: 20,
    });
    globalForDb.__outlawDb = drizzle(client, { schema });
  }
  return globalForDb.__outlawDb;
}
