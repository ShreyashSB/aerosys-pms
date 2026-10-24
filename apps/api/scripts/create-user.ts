import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hashPassword } from '../src/auth/password.js';
import { ROLES, type Role } from '../src/auth/permissions.js';
import * as schema from '../src/db/schema.js';

/**
 * Gives someone a login, creating the employee first if their email is new.
 * This is how the first Management account gets into an empty database;
 * after that, accounts are managed from the Employees page.
 *
 *   pnpm db:create-user -- --name "Rajesh Kulkarni" --email rajesh@aerosyshvac.in --role management --password 'a-strong-start'
 *
 * The person is asked to choose their own password at first sign-in.
 */
const { values } = parseArgs({
  // pnpm passes the `--` separator through; drop it.
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: { name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', default: 'management' }, password: { type: 'string' } },
});
const url = process.env.DATABASE_URL;
const email = values.email?.trim().toLowerCase();
const role = values.role as Role;
if (!url || !email || !values.password || !ROLES.includes(role) || values.password.length < 8) {
  console.error('Usage: DATABASE_URL=… pnpm db:create-user -- --name "Full Name" --email you@company.in --role management --password <8+ characters>');
  console.error(`Roles: ${ROLES.join(', ')}`);
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });
try {
  let [emp] = await db.select().from(schema.employees).where(sql`lower(${schema.employees.email}) = ${email}`);
  if (!emp) {
    if (!values.name) throw new Error(`No employee with ${email}; add --name to create one`);
    [emp] = await db
      .insert(schema.employees)
      .values({ code: `EMP-${Date.now().toString(36).toUpperCase()}`, name: values.name, email, department: 'Management', designation: 'Administrator', dailyCost: 0, joiningDate: new Date().toISOString().slice(0, 10) })
      .returning();
  }
  const passwordHash = await hashPassword(values.password);
  // Running it again for the same person resets their login instead of failing.
  await db
    .insert(schema.users)
    .values({ employeeId: emp.id, role, passwordHash, mustChangePassword: true })
    .onConflictDoUpdate({ target: schema.users.employeeId, set: { role, passwordHash, mustChangePassword: true, active: true } });
  console.log(`${emp.name} <${email}> can now sign in as ${role}. They will be asked to choose a new password.`);
} finally {
  await client.end();
}
