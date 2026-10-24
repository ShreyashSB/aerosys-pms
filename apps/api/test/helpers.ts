import type { INestApplication } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { hashPassword } from '../src/auth/password.js';
import type { Role } from '../src/auth/permissions.js';
import * as schema from '../src/db/schema.js';

export type Api = () => TestAgent;

const PASSWORD = 'test-password-1';

/**
 * Creates an employee with a login of the given role straight in the
 * database, signs in through the API and returns a request maker that sends
 * the token with every call.
 */
export async function signIn(app: INestApplication, role: Role = 'management', name = `Test ${role}`): Promise<{ api: Api; employeeId: string; token: string }> {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `${role}.${tag}@test.aerosyshvac.in`;
  try {
    const [emp] = await db
      .insert(schema.employees)
      .values({ code: `T-${tag}`, name, email, department: 'Management', designation: 'Tester', dailyCost: 1000, joiningDate: '2020-01-01' })
      .returning();
    await db.insert(schema.users).values({ employeeId: emp.id, role, passwordHash: await hashPassword(PASSWORD), mustChangePassword: false });
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
    const token = res.body.token as string;
    return { api: () => request.agent(app.getHttpServer()).set('Authorization', `Bearer ${token}`), employeeId: emp.id, token };
  } finally {
    await client.end();
  }
}
