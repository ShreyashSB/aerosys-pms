import { count, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema.js';
import { hashPassword } from './password.js';

export interface FirstAdmin {
  name: string;
  email: string;
  password: string;
}

/**
 * Gives an empty database its first Management login, from environment
 * variables, so a fresh deployment can be signed in to without running a
 * script (Render's free plan has no shell). It does nothing once any login
 * exists, so leaving the variables set is harmless, and the person must pick
 * a new password at first sign-in, so the one in the variables stops working.
 *
 * Returns true when it created the login.
 */
export async function ensureFirstAdmin(databaseUrl: string, admin: FirstAdmin): Promise<boolean> {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  try {
    return await db.transaction(async (tx) => {
      // Two instances starting together must not both create one: lock the table first.
      await tx.execute(sql`LOCK TABLE users IN EXCLUSIVE MODE`);
      const [{ n }] = await tx.select({ n: count() }).from(schema.users);
      if (n > 0) return false;
      const email = admin.email.trim().toLowerCase();
      // Same numbering as the Employees page: one more than the highest EMP number in use.
      const codes = await tx.select({ code: schema.employees.code }).from(schema.employees);
      const code = `EMP-${String(Math.max(0, ...codes.map((r) => Number(r.code.split('-').pop()) || 0)) + 1).padStart(3, '0')}`;
      const [emp] = await tx
        .insert(schema.employees)
        .values({ code, name: admin.name.trim(), email, department: 'Management', designation: 'Administrator', dailyCost: 0, joiningDate: new Date().toISOString().slice(0, 10) })
        .onConflictDoUpdate({ target: schema.employees.email, set: { name: admin.name.trim() } })
        .returning();
      await tx.insert(schema.users).values({ employeeId: emp.id, role: 'management', passwordHash: await hashPassword(admin.password), mustChangePassword: true });
      return true;
    });
  } finally {
    await client.end();
  }
}
