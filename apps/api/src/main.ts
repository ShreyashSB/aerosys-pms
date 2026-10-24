import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { runMigrations } from './db/migrate.js';

async function bootstrap() {
  // Local development reads apps/api/.env; on Render the host sets real environment variables.
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv();

  if (env.MIGRATE_ON_START) {
    await runMigrations(env.DATABASE_URL);
  }

  const app = await NestFactory.create(AppModule);
  // Every route lives under /api, e.g. GET /api/health.
  app.setGlobalPrefix('api');
  // Allow the React app (a different origin) to call the API from the browser.
  app.enableCors({ origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()), credentials: true });
  // Run OnApplicationShutdown hooks (closing the DB pool) when the host stops the container.
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  console.log(`API listening on http://localhost:${env.PORT}/api`);
}
await bootstrap();
