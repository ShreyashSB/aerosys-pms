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
- Money will be stored as whole paise in `bigint` (₹1,250.50 is stored as `125050`) to avoid rounding errors.
- Calculated KPIs are not stored as the truth; they are computed from the raw rows.
