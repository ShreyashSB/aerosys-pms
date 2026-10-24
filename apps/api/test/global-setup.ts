import { runMigrations } from '../src/db/migrate.js';

/** Runs once before all e2e files: bring the test database up to the latest migration. */
export default async function setup() {
  await runMigrations(process.env.DATABASE_URL!);
}
