# 00 — Start here

This folder teaches every tool in the repo, in the order you will meet them.
Each guide maps the new tool to something you already know from Angular, Java, Spring Boot, Maven and AWS.

| # | Guide | You know | You will learn |
| --- | --- | --- | --- |
| 01 | [Monorepo and pnpm](01-monorepo-and-pnpm.md) | Maven multi-module project | How several apps share one repo and one install |
| 02 | [React in this repo](02-react-in-this-repo.md) | Angular components, services, RxJS | Function components, hooks, TanStack Query |
| 03 | [NestJS](03-nestjs.md) | Spring Boot, Angular DI | Modules, controllers, providers, pipes |
| 04 | [Drizzle and PostgreSQL](04-drizzle-and-postgres.md) | JPA / Hibernate, Flyway | Schema as code, typed queries, migrations |
| 05 | [Docker and free deployment](05-docker-and-deploy.md) | AWS, building a JAR | Images, containers, Compose, Neon / Render / Vercel |
| 06 | [Views and themes](06-views-and-themes.md) | Angular services holding shared state, SCSS variables | React Context, CSS design tokens, switching layouts |
| 07 | [Login and roles](07-login-and-roles.md) | Spring Security, `@PreAuthorize` | Password hashing, JWT, Nest guards, row-level rules |
| 08 | [Notifications](08-notifications.md) | Spring `ApplicationEventPublisher`, `@Scheduled` | Postgres arrays and GIN indexes, `INSERT … SELECT`, `ON CONFLICT DO NOTHING`, a job without cron |

## The big picture

```
Browser (React app, apps/web)
   |  HTTPS + JSON   e.g. POST /api/clients {"name": "Tata Projects"}
   v
API (NestJS, apps/api)
   controller  -> checks the request, calls a service
   service     -> business rules, talks to the database through Drizzle
   |  SQL
   v
PostgreSQL (Neon in the cloud, or a Docker container locally)
```

## How a request flows (follow it in the code)

Take "Add new client" from the project form:

1. The React form sends `POST /api/clients` with `{ "name": "Tata Projects" }`.
2. `apps/api/src/clients/clients.controller.ts` receives it. The `ZodValidationPipe` checks the body first; a bad body gets a 400 and never reaches your code.
3. `ClientsService.create` (`clients.service.ts`) looks for a client with the same name, ignoring case, and returns it if found. Otherwise it inserts a new row.
4. Drizzle turns `db.insert(clients).values(...)` into SQL and returns the new row, fully typed.
5. Nest turns the returned object into JSON. The status is 201 Created.

The e2e test `apps/api/test/api.e2e-spec.ts` does exactly this against a real database. Reading a test is often the fastest way to understand a feature.

## Suggested way to learn

1. Open a Codespace (see the root README) and run `pnpm dev:api`.
2. Call the API with the terminal: `curl localhost:3000/api/health`, then
   `curl -X POST localhost:3000/api/clients -H 'content-type: application/json' -d '{"name":"Tata Projects"}'`.
3. Read guides 01 to 05 with the code open beside them.
4. Exercise: add `GET /api/project-types` by copying the clients feature. Guide 03 ends with the steps.
