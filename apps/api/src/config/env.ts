import { z } from 'zod';

/**
 * All configuration comes from environment variables, checked once at startup.
 * If something required is missing the app refuses to start with a clear
 * message, instead of failing later on the first request.
 */
/** A variable left blank in a host's dashboard arrives as "", which means "not set". */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

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
  /**
   * Signs login tokens. Anyone who knows it can sign in as anyone, so in
   * production it must be a long random value (Render generates one).
   */
  JWT_SECRET: z.string().min(1).default('dev-only-secret-change-me'),
  /** How long a login lasts, e.g. 12h or 7d. */
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'Use a number and s, m, h or d, e.g. 12h').default('12h'),
  /**
   * The first Management login for an empty database (see auth/first-admin.ts).
   * Set all three or none; ignored once any login exists.
   */
  FIRST_ADMIN_NAME: optional(z.string().trim().min(1)),
  FIRST_ADMIN_EMAIL: optional(z.email()),
  FIRST_ADMIN_PASSWORD: optional(z.string().min(8, 'Use at least 8 characters')),
}).refine((e) => e.NODE_ENV !== 'production' || (e.JWT_SECRET.length >= 32 && e.JWT_SECRET !== 'dev-only-secret-change-me'), {
  path: ['JWT_SECRET'],
  message: 'Set JWT_SECRET to a random value of at least 32 characters in production',
}).refine((e) => [e.FIRST_ADMIN_NAME, e.FIRST_ADMIN_EMAIL, e.FIRST_ADMIN_PASSWORD].filter(Boolean).length % 3 === 0, {
  path: ['FIRST_ADMIN_EMAIL'],
  message: 'Set FIRST_ADMIN_NAME, FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD together, or none of them',
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
