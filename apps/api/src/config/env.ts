import { z } from 'zod';

/**
 * All configuration comes from environment variables, checked once at startup.
 * If something required is missing the app refuses to start with a clear
 * message, instead of failing later on the first request.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Postgres connection string, e.g. from Neon: postgresql://user:pass@host/db?sslmode=require */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see apps/api/.env.example)'),
  /** Comma-separated list of front-end origins allowed to call the API. */
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  /** Apply pending database migrations when the server starts. */
  MIGRATE_ON_START: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}
