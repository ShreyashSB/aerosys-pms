import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ensureFirstAdmin } from '../src/auth/first-admin.js';
import { verifyPassword } from '../src/auth/password.js';
import { loadEnv } from '../src/config/env.js';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';

/**
 * A fresh deployment gets its first login from environment variables. This
 * needs a database with no logins at all, so it makes its own and drops it after.
 */
describe('First Management login (e2e)', () => {
  const name = `aerosys_first_admin_${Date.now().toString(36)}`;
  const adminUrl = process.env.DATABASE_URL!;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const admin = { name: 'Asha Patil', email: 'Asha.Patil@Example.in', password: 'start-here-1' };

  beforeAll(async () => {
    const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
    await sql.unsafe(`CREATE DATABASE ${name}`);
    await sql.end();
    await runMigrations(url.toString());
  });

  afterAll(async () => {
    const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
    await sql.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await sql.end();
  });

  it('creates one Management login that must change its password, and only once', async () => {
    expect(await ensureFirstAdmin(url.toString(), admin)).toBe(true);
    expect(await ensureFirstAdmin(url.toString(), { ...admin, email: 'someone.else@example.in' })).toBe(false);

    const client = postgres(url.toString(), { max: 1 });
    const db = drizzle(client, { schema });
    const rows = await db.select().from(schema.users).innerJoin(schema.employees, eq(schema.users.employeeId, schema.employees.id));
    await client.end();
    expect(rows).toHaveLength(1);
    const [{ users, employees }] = rows;
    expect(employees).toMatchObject({ code: 'EMP-001', email: 'asha.patil@example.in', name: 'Asha Patil' });
    expect(users).toMatchObject({ role: 'management', mustChangePassword: true, active: true });
    expect(await verifyPassword(admin.password, users.passwordHash)).toBe(true);
  });

  it('needs all three variables or none, and treats blank as not set', () => {
    const base = { DATABASE_URL: 'postgres://x' };
    expect(() => loadEnv({ ...base, FIRST_ADMIN_EMAIL: 'a@b.in' })).toThrow(/together/);
    expect(loadEnv({ ...base, FIRST_ADMIN_NAME: '', FIRST_ADMIN_EMAIL: '', FIRST_ADMIN_PASSWORD: '' }).FIRST_ADMIN_EMAIL).toBeUndefined();
    expect(loadEnv({ ...base, FIRST_ADMIN_NAME: 'A', FIRST_ADMIN_EMAIL: 'a@b.in', FIRST_ADMIN_PASSWORD: 'eight-chars' }).FIRST_ADMIN_NAME).toBe('A');
  });
});
