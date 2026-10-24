# 04 — Drizzle and PostgreSQL

**PostgreSQL** is the database: tables, rows, SQL, transactions, like MySQL or Oracle.
**Drizzle** is how TypeScript talks to it. It sits between plain SQL and a full ORM: you write queries that look like SQL, and every result is typed.

## JPA / Hibernate to Drizzle

| JPA world | Drizzle | In this repo |
| --- | --- | --- |
| `@Entity` class | `pgTable('clients', { ... })` | `apps/api/src/db/schema.ts` |
| `@Id @GeneratedValue` | `uuid('id').primaryKey().defaultRandom()` | |
| `@Column(nullable=false, unique=true)` | `text('name').notNull().unique()` | |
| Entity class as a type | `typeof clients.$inferSelect` (`Client`) | bottom of `schema.ts` |
| `EntityManager` / repository | the `db` object, injected with `@Inject(DB)` | `db/db.module.ts` |
| JPQL / Criteria API | `db.select().from(clients).where(...)` | `clients/clients.service.ts` |
| Flyway / Liquibase SQL files | `drizzle/0000_init.sql`, generated from the schema | `apps/api/drizzle/` |
| Lazy loading, dirty checking | None: every query is explicit, nothing happens behind your back | |

## Schema as code

```ts
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  ...timestamps,           // created_at, updated_at on every table
});
```

The TypeScript name (`createdAt`) and the column name (`created_at`) can differ: TypeScript uses camelCase, the database uses snake_case.

## Queries read like SQL

```ts
await db.select().from(clients).orderBy(asc(clients.name));
//   SELECT * FROM clients ORDER BY name

await db.insert(clients).values({ name: 'Tata Projects' }).returning();
//   INSERT INTO clients (name) VALUES ('Tata Projects') RETURNING *

await db.select().from(clients).where(sql`lower(${clients.name}) = lower(${input.name})`);
//   values are always sent as parameters, so this is safe from SQL injection
```

Hover over a result in the editor: its type is `Client[]`. Rename a column in `schema.ts` and every query that uses it stops compiling. That is the main reason to use Drizzle.

## Migrations: how the database changes over time

1. Edit `apps/api/src/db/schema.ts`, for example add `gstNumber: text('gst_number')` to `clients`.
2. Run `pnpm db:generate`. Drizzle compares the schema with its last snapshot and writes `drizzle/0002_<name>.sql` with the `ALTER TABLE`.
3. **Read the SQL file.** Commit it with the schema change.
4. It is applied by `pnpm db:migrate`, or automatically when the API starts with `MIGRATE_ON_START=true` (how Render deploys). Drizzle records applied files in its own table, so each runs once.

Data that must exist (like the five project types) goes in a **custom migration**: `pnpm --filter @aerosys/api drizzle-kit generate --custom --name <name>` creates an empty SQL file you fill in. See `0001_seed_project_types.sql`.

Never edit a migration that has already run on a shared database. Add a new one instead.

## Look at the data

`pnpm --filter @aerosys/api db:studio` opens Drizzle Studio, a table browser in your browser. The Neon dashboard also has a SQL editor.

## Conventions we follow

- Every table has `id uuid`, `created_at`, `updated_at`.
- Money and man-days are `numeric(14, 2)`: exact decimals in Postgres (no float rounding when it sums), read into TypeScript as plain numbers with `mode: 'number'`. That is exact for any amount this business will see. We picked this over storing whole paise in `bigint` because every screen and form already works in rupees.
- Calculated KPIs are not stored as the truth; they are computed from the raw rows.

## Relations: employees and projects

`projects` points at four other tables with **foreign keys**: `client_id`, `site_id`, `project_type_id` and `manager_id`. Postgres then refuses a project whose manager doesn't exist, and refuses deleting a client that a project still uses. The database guards the data even if the code has a bug.

The web app wants a flat project (`clientName: "Tata Projects"`), not ids. `ProjectsService.selectProjects()` does that with **JOINs**:

```ts
db.select({ id: projects.id, clientName: clients.name, /* … */ })
  .from(projects)
  .innerJoin(clients, eq(projects.clientId, clients.id))
//   SELECT projects.id, clients.name AS "clientName" … FROM projects INNER JOIN clients ON …
```

Saving goes the other way. The form sends names, and `LookupsService.findOrCreate` turns each one into an id, adding it the first time ("Add new"). That runs inside a **transaction**:

```ts
await db.transaction(async (tx) => {
  const clientId = await lookups.findOrCreate(clients, input.clientName, tx);
  await tx.insert(projects).values({ ...fields, clientId });
}); // both rows are saved, or neither
```

If the project insert fails (say the project ID is taken), the new client row is rolled back too, so no orphan clients are left behind.

## Money tables: expenses, bills and costs

Four Postgres features do work here that would otherwise be code:

- **A sequence for expense numbers.** `expense_code_seq` hands out 1001, 1002, … and the `code` column defaults to `'EXP-' || nextval('expense_code_seq')`. Two people submitting at the same moment can never get the same number, which "read the highest code, add one" can't promise.
- **An index on an expression.** `project_bills_number_idx` is unique on `(project_id, kind, lower(number))`, so `INV-7` and `inv-7` count as the same invoice number.
- **A conditional update.** Approving runs `UPDATE expenses SET status = 'approved' … WHERE id = $1 AND status = 'pending'`. If two managers press Approve at once, only one update finds a pending row; the other gets no row back and a clear "already approved" answer.
- **`jsonb` for small nested data.** A receipt is `{ fileName, size, mimeType }`, stored in one `jsonb` column and typed in TypeScript with `.$type<Attachment>()`. The file itself goes to object storage in a later step.

**Try it:** run `pnpm db:studio`, open `expenses`, and add a row without a code. Postgres fills it in.

## Instruments and reviews: derive, don't duplicate

- **Status from history.** An instrument is "assigned" when it has a deployment with no `returned_at`. We don't store that twice. `InstrumentsService` LEFT JOINs the open deployment and works the status out in SQL:

  ```sql
  CASE WHEN instrument_deployments.id IS NULL THEN instruments.status ELSE 'assigned' END
  ```

  If a project is deleted, its deployments go with it (cascade), and the instrument shows as available again by itself.
- **Upsert.** Saving PM reviews runs `INSERT … ON CONFLICT (project_id, employee_id) DO UPDATE SET rating = excluded.rating, …`. `excluded` is the row we tried to insert. Reviewing an engineer again changes the earlier review instead of adding a second one, in one statement.
