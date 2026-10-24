import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema.js';
import { seedDemo } from './seed-demo.js';

/**
 * pnpm --filter @aerosys/api db:seed -- --yes
 *
 * Wipes the data in DATABASE_URL and loads the demo data. It asks for --yes
 * because it deletes everything first; never point it at real company data.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL first');
if (!process.argv.includes('--yes')) {
  console.error(`This deletes all data in ${new URL(url).host}${new URL(url).pathname} and loads the demo. Run again with --yes.`);
  process.exit(1);
}

// onnotice: keep Postgres' "truncate cascades to …" notices out of the output.
const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  const counts = await seedDemo(drizzle(client, { schema }));
  console.log('Seeded demo data:', counts);
} finally {
  await client.end();
}
