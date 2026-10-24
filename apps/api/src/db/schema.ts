import { boolean, date, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Database tables, written as TypeScript. Drizzle reads this file to
 * (1) generate SQL migrations with `pnpm db:generate` and
 * (2) give every query full types, so `db.select().from(clients)` returns `Client[]`.
 *
 * Lookup lists (clients, sites, project types) grow from the "Add new" option
 * in the project form dropdowns. Employees and projects follow; more tables
 * are added module by module.
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

/** Money and man-day columns: exact decimals in Postgres, plain numbers in TypeScript. */
const amount = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // EMP-001
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().default(''),
  /** Management, Projects, Engineering, Accounts, Admin or Service. */
  department: text('department').notNull(),
  designation: text('designation').notNull(),
  /** Internal costing rate in ₹ per man-day, entered directly (not derived from salary). */
  dailyCost: amount('daily_cost').notNull(),
  joiningDate: date('joining_date', { mode: 'string' }).notNull(),
  /** active, on_leave or inactive. */
  status: text('status').notNull().default('active'),
  isSiteEngineer: boolean('is_site_engineer').notNull().default(false),
  baseLocation: text('base_location').notNull().default(''),
  ...timestamps,
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // PRJ-2026-001, editable
    name: text('name').notNull(),
    // Foreign keys: Postgres refuses a project that points at a client, site,
    // type or manager that doesn't exist, and refuses deleting one still in use.
    clientId: uuid('client_id').notNull().references(() => clients.id),
    siteId: uuid('site_id').notNull().references(() => sites.id),
    projectTypeId: uuid('project_type_id').notNull().references(() => projectTypes.id),
    managerId: uuid('manager_id').notNull().references(() => employees.id),
    workOrderNo: text('work_order_no').notNull().default(''),
    poNo: text('po_no').notNull().default(''),
    contractValue: amount('contract_value').notNull(),
    estimatedCost: amount('estimated_cost').notNull(),
    allottedManDays: amount('allotted_man_days').notNull(),
    allottedExpenses: amount('allotted_expenses').notNull().default(0),
    /** ₹ per calendar day of the project. */
    operationalCostPerDay: amount('operational_cost_per_day').notNull().default(150),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    /** Start of the current measurement (RA bill) period. */
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    description: text('description').notNull().default(''),
    /** planning, active, on_hold, completed or archived. */
    status: text('status').notNull().default('planning'),
    ...timestamps,
  },
  (t) => [index('projects_manager_idx').on(t.managerId), index('projects_status_idx').on(t.status)],
);

/** Row types inferred from the tables: what a SELECT returns and what an INSERT accepts. */
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type ProjectType = typeof projectTypes.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
