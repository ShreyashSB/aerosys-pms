# 05 — Docker and free deployment

## Docker in one page

| Term | Meaning | Java comparison |
| --- | --- | --- |
| **Image** | A packaged app plus everything it needs to run (Node, dependencies, compiled code) | A fat JAR that also contains the JVM and OS libraries |
| **Container** | A running instance of an image | A running `java -jar` process, isolated |
| **Dockerfile** | The recipe that builds an image | The Maven build that produces the JAR |
| **Registry** | Where images are stored (Docker Hub, AWS ECR) | Maven Central / Nexus |
| **Docker Compose** | Runs several containers together from one file | |

The point: the image that passes CI is exactly what runs on Render now and on AWS later. "Works on my machine" stops being a problem.

### Our Dockerfile (`apps/api/Dockerfile`)

It has two **stages**:

1. **build**: installs all dependencies, compiles TypeScript to JavaScript (`nest build`), then `pnpm deploy` copies only the API and its production dependencies into `/out`.
2. **runtime**: starts from a clean Node image and copies in only `dist/`, production `node_modules` and the `drizzle/` migrations. No compilers or dev tools, so the image is smaller and safer. It runs as the non-root `node` user.

It is built from the repo root because it needs the workspace files: `docker build -f apps/api/Dockerfile -t aerosys-api .`

### Docker Compose (`docker-compose.yml`)

`docker compose up --build` starts Postgres and the API together, waits for Postgres to be healthy, runs migrations and serves `http://localhost:3000/api/health`. In a Codespace, `docker compose up -d db` runs just the database (done for you on start).

## Free deployment, step by step

You need three free accounts. Sign in to each with GitHub.

### 1. Database: Neon

1. [neon.tech](https://neon.tech) -> **New project**. Name `aerosys`, Postgres 17, region **AWS Asia Pacific (Singapore)**, the closest to India.
2. **Connect** -> copy the connection string (`postgresql://...neon.tech/neondb?sslmode=require`).
3. Keep it secret: anyone with it can read and change the data.

Free plan: 0.5 GB storage, the database sleeps when idle and wakes on the next query in about a second.

### 2. API: Render

1. [render.com](https://render.com) -> **New -> Blueprint** -> pick this repository. Render reads `render.yaml` and proposes the `aerosys-api` service (Docker, Singapore, free).
2. It asks for the two secret values:
   - `DATABASE_URL`: the Neon string.
   - `WEB_ORIGIN`: the Vercel URL from step 3 (put `http://localhost:5173` for now and update it later).
3. Deploy. Render builds the Docker image, starts it, runs migrations, and checks `/api/health`.
4. Open `https://aerosys-api.onrender.com/api/health` (your name may differ). You should see `"database":"up"`.

Free plan: the service sleeps after 15 minutes without requests; the first request after that takes about a minute. Fine for development, not for 60 daily users.

### 3. Web: Vercel

1. [vercel.com](https://vercel.com) -> **Add New -> Project** -> import this repository.
2. Leave **Root Directory** empty. The root `vercel.json` tells Vercel to install the whole workspace with pnpm, build only `@aerosys/web`, and publish `apps/web/dist`.
3. Deploy. Every push to a branch gets its own preview URL.
4. To use the real API instead of the in-browser demo, add the environment variable `VITE_API_BASE_URL` = your Render URL (Settings -> Environment Variables) and redeploy. Then put the Vercel URL in Render's `WEB_ORIGIN`, so the API accepts requests from it.

Vercel's free Hobby plan is for non-commercial use, so it is right for development and demos. Production moves to AWS Mumbai with the same Docker image.

## What CI does (`.github/workflows/ci.yml`)

On every push and pull request GitHub Actions: installs with the lockfile, typechecks and builds both apps, runs unit tests, starts a throwaway Postgres and runs the API's end-to-end tests, and builds the API's Docker image. A red check on the pull request means something broke.
