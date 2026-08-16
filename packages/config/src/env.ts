import { z } from "zod";

/**
 * Server-side environment schema. `NEXT_PUBLIC_*` variables are bundled to
 * the browser; everything else must never leak into client code.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required."),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  AI_PROVIDER: z.enum(["deepseek", "fake"]).default("fake"),
  AI_MODEL: z.string().min(1).default("deepseek-v4-flash"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().optional().default("https://api.deepseek.com"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required."),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;
let cachedClientEnv: ClientEnv | null = null;

/**
 * Validates the server environment once per process. Throws when required
 * production configuration is missing — never silently continues.
 */
export function getServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = serverEnvSchema.parse(env);
  }
  return cachedServerEnv;
}

export function getClientEnv(env: NodeJS.ProcessEnv = process.env): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = clientEnvSchema.parse(env);
  }
  return cachedClientEnv;
}

/** Resets caches — used by tests. */
export function resetEnvCaches(): void {
  cachedServerEnv = null;
  cachedClientEnv = null;
}
