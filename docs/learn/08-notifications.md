# 08 — Notifications

The bell in the top bar now reads from Postgres. Expense submitted? Management, accounts and the project's manager hear about it. Expense rejected? Only the person who claimed it does. This chapter shows how one table serves all of them.

## 1. One row, many readers

A notification is written once, with who it is for:

```ts
audienceRoles: text('audience_roles').array(),            // e.g. {management,accounts}
audienceEmployeeIds: uuid('audience_employee_ids').array(), // e.g. {<the PM's id>}
```

These are **Postgres arrays**: one column holding a list. "Is this for me?" is:

```sql
audience_roles @> ARRAY['accounts']  OR  audience_employee_ids @> ARRAY['<my id>'::uuid]
```

`@>` means "contains". A normal (B-tree) index can't answer it, so the table has **GIN indexes** on both columns. GIN indexes the *elements* of each array, the way a book's index lists every word rather than every page.

## 2. Read or unread is per person

If one notification goes to five people, "read" can't be a column on it. It is a separate table, one row per (notification, login), with a two-column primary key:

```ts
primaryKey({ columns: [t.notificationId, t.userId] })
```

- **Mark one read:** `INSERT … ON CONFLICT DO NOTHING`. Pressing it twice is harmless.
- **Mark all read:** a single `INSERT INTO notification_reads SELECT id, <me> FROM notifications WHERE <visible to me>`. Postgres copies the ids itself; Node never sees them.
- **Listing:** a `LEFT JOIN` on `notification_reads` for *my* id says read or not, in the same query.

## 3. Raising one: a side effect that must not fail the request

`ExpensesService.create` saves the expense, then calls `notifications.notify(...)`. `notify` catches its own errors and only logs them. The expense is already saved; a hiccup in the bell shouldn't tell the engineer their claim failed.

`NotificationsModule` is `@Global()`, so every service can just put `private readonly notifications: NotificationsService` in its constructor, like `DB`.

## 4. A "daily" job with no cron

Deadline and near-completion alerts are time-based: nobody presses a button. Render's free plan has no cron and puts the server to sleep, so `runChecksIfDue()` runs when someone opens their notifications, at most once an hour per server.

Running it twice must not alert twice. Each such alert carries a `dedupeKey` (`deadline:<project>:<date>`) with a **unique** constraint, and the insert says `ON CONFLICT (dedupe_key) DO NOTHING`. The database, not our code, guarantees "only once".

Progress for those alerts (`notifications/progress.ts`) is one SQL query: `SUM(qty × rate)` over executions, divided by `SUM(contract_qty × rate)` over BOQ items, the same rule as the web's `progressFromBoq`.

## Try it

```bash
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"pooja.nair@aerosyshvac.in","password":"demo1234"}' | jq -r .token)
curl -s localhost:3000/api/notifications -H "Authorization: Bearer $TOKEN" | jq '.[0]'
curl -s -X POST localhost:3000/api/notifications/read-all -H "Authorization: Bearer $TOKEN" -w '%{http_code}\n'
```

Then in the Neon SQL editor: `SELECT * FROM notification_reads;`. There is one row for each notification Pooja just read.
