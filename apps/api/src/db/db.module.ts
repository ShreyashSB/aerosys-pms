import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

/** Injection token: other classes ask for the database with `@Inject(DB)`. */
export const DB = Symbol('DB');
const SQL_CLIENT = Symbol('SQL_CLIENT');

/** Closes the connection pool when the app stops, so deploys don't leak connections. */
@Injectable()
class SqlShutdown implements OnApplicationShutdown {
  constructor(@Inject(SQL_CLIENT) private readonly sql: postgres.Sql) {}
  async onApplicationShutdown() {
    await this.sql.end({ timeout: 5 });
  }
}

/**
 * @Global() means every other module can inject DB without importing DbModule.
 * Providers here are "factories": Nest calls useFactory once at startup and
 * shares the result (a singleton) with everyone who injects it.
 */
@Global()
@Module({
  providers: [
    {
      provide: SQL_CLIENT,
      inject: [ENV],
      // A small pool is plenty for ~60 users and stays inside free-tier connection limits.
      useFactory: (env: Env) => postgres(env.DATABASE_URL, { max: 5 }),
    },
    {
      provide: DB,
      inject: [SQL_CLIENT],
      useFactory: (sql: postgres.Sql): Database => drizzle(sql, { schema }),
    },
    SqlShutdown,
  ],
  exports: [DB],
})
export class DbModule {}
