# Aerosys HVAC — Project Management System

Project performance, cost control and profitability for Aerosys HVAC.
This repo holds the whole system as a **monorepo**: several apps in one Git repository, installed and tested together.

```
apps/
  web/     React app (the prototype UI) — what users see
  api/     NestJS API + Drizzle + PostgreSQL — where data and rules live
docs/
  learn/   Step-by-step guides to every tool used here (start with 00)
```

New to React, NestJS, Drizzle or monorepos? Read **[docs/learn/00-start-here.md](docs/learn/00-start-here.md)** first.

## Run it without installing anything (GitHub Codespaces)

1. On GitHub: **Code -> Codespaces -> Create codespace on this branch**. A cloud machine with Node, pnpm, Docker and Postgres opens in your browser (free for personal accounts up to 120 core-hours a month).
2. In its terminal:

   ```bash
   pnpm dev:api     # API on port 3000 -> /api/health
   pnpm dev:web     # Web on port 5173 (open a second terminal)
   ```

3. The **Ports** tab gives you a browser link for each.

Stop the codespace when you finish (**Codespaces -> Stop**) so it does not use your free hours.

## Commands (from the repo root)

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies for every app |
| `pnpm dev:web` / `pnpm dev:api` | Runs one app with live reload |
| `pnpm build` / `pnpm typecheck` / `pnpm test` | Runs that script in every app |
| `pnpm db:generate` | Writes a SQL migration after you change `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Applies pending migrations to `DATABASE_URL` |
| `docker compose up --build` | Runs the API + Postgres in containers |

## Free hosting (development and demos)

| Piece | Service (free plan) | Notes |
| --- | --- | --- |
| Database | [Neon](https://neon.tech) Postgres | 0.5 GB; pick the Singapore region |
| API | [Render](https://render.com) web service from `render.yaml` | Docker build; sleeps after 15 min idle, ~1 min to wake |
| Web | [Vercel](https://vercel.com) Hobby, configured by the root `vercel.json` | Fine for development; Hobby is not for commercial production use |

Step-by-step setup: [docs/learn/05-docker-and-deploy.md](docs/learn/05-docker-and-deploy.md).
Production later moves to AWS Mumbai (see the build plan).
