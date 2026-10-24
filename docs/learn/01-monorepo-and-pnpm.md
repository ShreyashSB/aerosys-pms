# 01 — Monorepo and pnpm

## What a monorepo is

One Git repository that holds several projects which are built and versioned together. Ours has two today:

```
package.json            root: scripts that run across all apps
pnpm-workspace.yaml     lists where the apps live (apps/*, packages/*)
pnpm-lock.yaml          ONE lockfile with the exact version of every dependency
apps/web/package.json   the React app's own dependencies and scripts
apps/api/package.json   the API's own dependencies and scripts
```

**Java comparison.** This is a Maven multi-module build:

| Maven | Here |
| --- | --- |
| parent `pom.xml` with `<modules>` | root `package.json` + `pnpm-workspace.yaml` |
| child `pom.xml` | `apps/*/package.json` |
| `<dependency>` | `"dependencies"` in package.json |
| `~/.m2` local repository | pnpm's global store (shared, linked into `node_modules`) |
| `mvn -pl api test` | `pnpm --filter @aerosys/api test` |
| `mvn test` at the parent | `pnpm -r test` (`-r` = recursive, every package) |
| `dependencyManagement` locking versions | `pnpm-lock.yaml` |

## Why bother

- **One pull request can change the API and the screen together**, so they never drift apart.
- **Shared code.** Soon `packages/core` will hold the KPI formulas and types. Both the web app and the API will import it, so a number is computed the same way everywhere. Today those formulas live in `apps/web/src/domain`; moving them is the next step.
- One CI pipeline, one install, one place to look.

## pnpm in five commands

```bash
pnpm install                              # install everything (run at the root)
pnpm --filter @aerosys/api add zod        # add a dependency to ONE app
pnpm --filter @aerosys/api add -D vitest  # ...as a dev dependency (like <scope>test</scope>)
pnpm dev:api                              # root script -> runs `start:dev` in apps/api
pnpm -r build                             # run `build` in every app
```

`@aerosys/web` and `@aerosys/api` are the `name` fields in each app's package.json; `--filter` picks by that name.

**Why pnpm and not npm?** It installs each package once on disk and links it, so installs are fast and small. It is also strict: an app can only import what its own package.json lists, which catches mistakes early.

## Rules of thumb

- Always run `pnpm install` from the **root**, never inside an app.
- Commit `pnpm-lock.yaml`. It is what makes CI and Docker install the same versions you tested.
- Never commit `node_modules` or `.env` files (see `.gitignore`).
