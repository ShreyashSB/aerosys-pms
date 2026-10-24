import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Applies any SQL files in ./drizzle that the database has not seen yet.
 * Drizzle records applied migrations in its own table, so running this
 * twice is safe.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  } finally {
    await sql.end();
  }
}
