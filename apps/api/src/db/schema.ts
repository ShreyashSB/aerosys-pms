import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Database tables, written as TypeScript. Drizzle reads this file to
 * (1) generate SQL migrations with `pnpm db:generate` and
 * (2) give every query full types, so `db.select().from(clients)` returns `Client[]`.
 *
 * We start with the three lookup lists from the 24 Oct change list: clients,
 * sites (locations) and project types. Each one grows from the "Add new"
 * option in the project form dropdowns. More tables follow phase by phase.
 */

/** Columns every table carries. */
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  ...timestamps,
});

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  city: text('city'),
  ...timestamps,
});

export const projectTypes = pgTable('project_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  ...timestamps,
});

/** Row types inferred from the tables: what a SELECT returns and what an INSERT accepts. */
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type ProjectType = typeof projectTypes.$inferSelect;
