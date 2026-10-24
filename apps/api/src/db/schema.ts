import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, numeric, pgSequence, pgTable, primaryKey, text, timestamp, uniqueIndex, unique, uuid } from 'drizzle-orm/pg-core';

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
/** BOQ quantities can have three decimals (e.g. 12.375 Cum). */
const quantity = (name: string) => numeric(name, { precision: 14, scale: 3, mode: 'number' });

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

/**
 * Who is on which project. Releasing an engineer sets `end_date` so the
 * history stays; at most one open assignment per person per project.
 */
export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // ON DELETE CASCADE: deleting a project deletes its assignments with it.
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id').notNull().references(() => employees.id),
    /** Lead Engineer, Site Engineer, Technician or Supervisor. */
    role: text('role').notNull(),
    /** Planned % of the person's time (1–100). */
    allocation: integer('allocation').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    ...timestamps,
  },
  (t) => [
    index('assignments_project_idx').on(t.projectId),
    index('assignments_employee_idx').on(t.employeeId),
    // A partial unique index: only rows still open (end_date IS NULL) take part.
    uniqueIndex('assignments_one_open_idx').on(t.projectId, t.employeeId).where(sql`${t.endDate} IS NULL`),
    check('assignments_allocation_check', sql`${t.allocation} BETWEEN 1 AND 100`),
  ],
);

/** The Annexure: the priced list of work in the work order. */
export const boqItems = pgTable(
  'boq_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    srNo: text('sr_no').notNull(),
    description: text('description').notNull(),
    uom: text('uom').notNull(),
    contractQty: quantity('contract_qty').notNull(),
    rate: amount('rate').notNull(),
    ...timestamps,
  },
  (t) => [index('boq_items_project_idx').on(t.projectId)],
);

/** One site day on a project: who was there and what got done. */
export const dailyLogs = pgTable(
  'daily_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    activities: text('activities').notNull().default(''),
    remarks: text('remarks').notNull().default(''),
    createdById: uuid('created_by_id').notNull().references(() => employees.id),
    ...timestamps,
  },
  (t) => [unique('daily_logs_project_date_unique').on(t.projectId, t.date)],
);

/** One row per person in a daily log. */
export const attendanceEntries = pgTable(
  'attendance_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dailyLogId: uuid('daily_log_id').notNull().references(() => dailyLogs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id').notNull().references(() => employees.id),
    /** on_site, off_site, idle, weekly_off, holiday or leave. */
    status: text('status').notNull(),
    /** Partial idle time for someone otherwise working. */
    idleHours: numeric('idle_hours', { precision: 4, scale: 2, mode: 'number' }).notNull().default(0),
    idleReason: text('idle_reason'),
  },
  (t) => [unique('attendance_log_employee_unique').on(t.dailyLogId, t.employeeId), index('attendance_employee_idx').on(t.employeeId)],
);

/** Quantity executed against a BOQ item, from a daily log or a manual measurement. */
export const boqExecutions = pgTable(
  'boq_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    boqItemId: uuid('boq_item_id').notNull().references(() => boqItems.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    /** Negative for a correction. */
    qty: quantity('qty').notNull(),
    remarks: text('remarks').notNull().default(''),
    /** Set when the quantity came from a daily log; editing the log replaces these rows. */
    dailyLogId: uuid('daily_log_id').references(() => dailyLogs.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('boq_executions_project_idx').on(t.projectId), index('boq_executions_item_idx').on(t.boqItemId)],
);

/** Company-wide settings: a single row with id = 1. */
export const settings = pgTable(
  'settings',
  {
    id: integer('id').primaryKey().default(1),
    companyName: text('company_name').notNull().default('Aerosys HVAC Solutions Pvt Ltd'),
    deadlineAlertDays: integer('deadline_alert_days').notNull().default(14),
    hoursPerManDay: numeric('hours_per_man_day', { precision: 4, scale: 2, mode: 'number' }).notNull().default(8),
    /** performance or budget. */
    projectionMethod: text('projection_method').notNull().default('performance'),
    targetMarginPct: numeric('target_margin_pct', { precision: 5, scale: 2, mode: 'number' }).notNull().default(15),
    ...timestamps,
  },
  (t) => [check('settings_single_row', sql`${t.id} = 1`)],
);

/**
 * A file attached to a row. For now only the details are stored; the file
 * itself moves to object storage in a later step.
 */
export interface Attachment {
  fileName: string;
  size: number;
  mimeType: string;
}

/** Postgres hands out expense numbers 1001, 1002, … even when two people submit at once. */
export const expenseCodeSeq = pgSequence('expense_code_seq', { startWith: 1001 });

/** Site expenses an engineer pays for and claims back. Each one waits in an approval queue. */
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code')
      .notNull()
      .unique()
      .default(sql`'EXP-' || nextval('expense_code_seq')`),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id').notNull().references(() => employees.id),
    /** Travel, Accommodation, Food, Local Conveyance, Site Material, Tools & Consumables or Other. */
    category: text('category').notNull(),
    amount: amount('amount').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    description: text('description').notNull().default(''),
    receipt: jsonb('receipt').$type<Attachment>(),
    /** When Accounts recorded it. Recorded expenses count towards project cost at once: there is no approval step. */
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    index('expenses_project_idx').on(t.projectId),
    check('expenses_amount_positive', sql`${t.amount} > 0`),
  ],
);

/** Vendor bills (a cost) and client invoices (billed revenue) recorded by Accounts. */
export const projectBills = pgTable(
  'project_bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    /** vendor_bill or client_invoice. */
    kind: text('kind').notNull(),
    number: text('number').notNull(),
    party: text('party').notNull(),
    amount: amount('amount').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    attachment: jsonb('attachment').$type<Attachment>(),
    notes: text('notes').notNull().default(''),
    createdById: uuid('created_by_id').notNull().references(() => employees.id),
    ...timestamps,
  },
  (t) => [
    index('project_bills_project_idx').on(t.projectId),
    // An index on an expression: "INV-7" and "inv-7" count as the same number.
    uniqueIndex('project_bills_number_idx').on(t.projectId, t.kind, sql`lower(${t.number})`),
    check('project_bills_amount_positive', sql`${t.amount} > 0`),
  ],
);

/** Other direct costs: sub-contract labour, equipment hire and the like. */
export const projectCosts = pgTable(
  'project_costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    /** subcontract, hire or other. */
    type: text('type').notNull(),
    description: text('description').notNull(),
    amount: amount('amount').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    ...timestamps,
  },
  (t) => [index('project_costs_project_idx').on(t.projectId), check('project_costs_amount_positive', sql`${t.amount} > 0`)],
);

/** A calibration certificate: the file details plus how long it is valid. */
export interface Calibration extends Attachment {
  validUntil: string | null;
}

/**
 * Company instruments. `status` holds available, maintenance or retired;
 * "assigned" is not stored but worked out from an open deployment, so it can
 * never disagree with the deployment history.
 */
export const instruments = pgTable(
  'instruments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // INS-001
    name: text('name').notNull(),
    serialNumber: text('serial_number').notNull(),
    /** Measurement, Refrigerant Handling, Air Balancing, Electrical Testing, Power Tools or Safety. */
    category: text('category').notNull(),
    assetValue: amount('asset_value').notNull(),
    purchaseDate: date('purchase_date', { mode: 'string' }).notNull(),
    endOfLifeDate: date('end_of_life_date', { mode: 'string' }).notNull(),
    currentLocation: text('current_location').notNull().default(''),
    calibration: jsonb('calibration').$type<Calibration>(),
    status: text('status').notNull().default('available'),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('instruments_serial_idx').on(sql`lower(${t.serialNumber})`),
    check('instruments_asset_value_positive', sql`${t.assetValue} > 0`),
    check('instruments_life_check', sql`${t.endOfLifeDate} > ${t.purchaseDate}`),
  ],
);

/** Each time an instrument goes out to a project. Drives the instrument cost on the project. */
export const instrumentDeployments = pgTable(
  'instrument_deployments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instrumentId: uuid('instrument_id').notNull().references(() => instruments.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    engineerId: uuid('engineer_id').references(() => employees.id),
    assignedAt: date('assigned_at', { mode: 'string' }).notNull(),
    returnedAt: date('returned_at', { mode: 'string' }),
    ...timestamps,
  },
  (t) => [
    index('instrument_deployments_project_idx').on(t.projectId),
    // An instrument can be out on only one project at a time.
    uniqueIndex('instrument_deployments_one_open_idx').on(t.instrumentId).where(sql`${t.returnedAt} IS NULL`),
  ],
);

/** Files on a project (work order, drawings, …). Only the details for now; the bytes go to object storage later. */
export const projectDocuments = pgTable(
  'project_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Work Order, Annexure / BOQ, Drawing, Measurement Sheet, Correspondence or Other. */
    type: text('type').notNull(),
    size: integer('size').notNull(),
    mimeType: text('mime_type').notNull(),
    uploadedById: uuid('uploaded_by_id').notNull().references(() => employees.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('project_documents_project_idx').on(t.projectId)],
);

/** The PM's rating of an engineer when a project closes. One per engineer per project. */
export const engineerReviews = pgTable(
  'engineer_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id').notNull().references(() => employees.id),
    reviewerId: uuid('reviewer_id').notNull().references(() => employees.id),
    rating: integer('rating').notNull(),
    comments: text('comments').notNull().default(''),
    ...timestamps,
  },
  (t) => [
    unique('engineer_reviews_project_employee_unique').on(t.projectId, t.employeeId),
    index('engineer_reviews_employee_idx').on(t.employeeId),
    check('engineer_reviews_rating_check', sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

/**
 * Who can sign in, and with which role. One account per employee; the email
 * is the employee's. Passwords are stored only as a scrypt hash.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .unique()
      .references(() => employees.id, { onDelete: 'cascade' }),
    /** management, project_manager, site_engineer or accounts. */
    role: text('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Set when an admin creates or resets the password: the person picks their own at next sign-in. */
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check('users_role_check', sql`${t.role} IN ('management', 'project_manager', 'site_engineer', 'accounts')`)],
);

/**
 * Something someone should know about: an expense to approve, an engineer
 * assigned, a deadline coming up. Who sees it is decided by role
 * (`audience_roles`) and by person (`audience_employee_ids`), both stored as
 * Postgres arrays so one row serves everyone it is meant for.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),
    audienceRoles: text('audience_roles').array().notNull().default(sql`'{}'`),
    audienceEmployeeIds: uuid('audience_employee_ids').array().notNull().default(sql`'{}'`),
    /** Alerts from the daily check ("deadline in 5 days") carry a key so they are raised once, not every day. */
    dedupeKey: text('dedupe_key').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_created_idx').on(t.createdAt),
    // GIN indexes make "is my role / my id in this array?" fast.
    index('notifications_roles_idx').using('gin', t.audienceRoles),
    index('notifications_employees_idx').using('gin', t.audienceEmployeeIds),
  ],
);

/** Who has read what: one row per (notification, login). */
export const notificationReads = pgTable(
  'notification_reads',
  {
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })],
);

/** Row types inferred from the tables: what a SELECT returns and what an INSERT accepts. */
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type ProjectType = typeof projectTypes.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type BoqItem = typeof boqItems.$inferSelect;
export type BoqExecution = typeof boqExecutions.$inferSelect;
export type DailyLogRow = typeof dailyLogs.$inferSelect;
export type AttendanceRow = typeof attendanceEntries.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ProjectBill = typeof projectBills.$inferSelect;
export type ProjectCost = typeof projectCosts.$inferSelect;
export type InstrumentRow = typeof instruments.$inferSelect;
export type InstrumentDeployment = typeof instrumentDeployments.$inferSelect;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type EngineerReview = typeof engineerReviews.$inferSelect;
export type UserRow = typeof users.$inferSelect;
