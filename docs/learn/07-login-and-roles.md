# 07 — Login and roles

How the API knows who you are (authentication) and what you may do (authorization).
In Spring terms: Spring Security's filter chain, `@PreAuthorize` and a `UserDetailsService`, built by hand in about 300 lines.

## 1. Accounts and passwords

- `users` has one row per person who can sign in: their employee, role, password hash, `active`, and `must_change_password`.
- Passwords are stored only as a **scrypt hash** (`src/auth/password.ts`). scrypt is slow and memory-hungry on purpose, so someone with a stolen database can't try millions of guesses. Each hash has its own random salt, so two people with the same password still get different hashes.
- `verifyPassword` compares with `timingSafeEqual`, which takes the same time whether the first or the last character is wrong.
- A wrong email and a wrong password get **the same answer** ("Wrong email or password"), and an unknown email still runs a hash check. Nobody can find out which emails have accounts.

## 2. Tokens

`POST /api/auth/login` checks the password and returns a **JWT**: a small signed note saying "user 5f3… , role management, valid for 12 hours". The API signs it with `JWT_SECRET`. Anyone can read a JWT, but nobody can change it without the secret.

The web app keeps the token and sends it on every request:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs…
```

**Why a header and not a cookie?** The web app (vercel.app) and the API (onrender.com) are different sites. Safari and other phone browsers block cookies sent to a different site, which would break login on iPhones. A header always works. When both move to one domain on AWS, we can switch to an httpOnly cookie.

## 3. The guard: every route is protected by default

`AuthGuard` (`src/auth/auth.guard.ts`) is registered as `APP_GUARD`, so Nest runs it before **every** route. A new route you forget to think about is still protected. It does four things in order:

1. `@Public()` routes (health check, login) pass.
2. It checks the token's signature, then **loads the account from the database**. A login switched off or a role changed takes effect on the next request, not when the token expires.
3. Until someone replaces an admin-set password, they can only call `/api/auth/me` and `/api/auth/change-password`.
4. `@Allow('expense.create')` on a route is checked against the role's list in `src/auth/permissions.ts`.

`permissions.ts` is the same table as the web app's `apps/web/src/auth/permissions.ts`. The web uses it to hide buttons; the API uses it to refuse requests, which is what actually protects the data. `permissions.spec.ts` fails if the two drift apart.

## 4. "Only your own projects"

A role permission says *what kind* of change you may make. `@ProjectScope('id', 'dailyLogs')` says *on which rows*: the guard looks up the daily log's project and calls `canActOnProject` (`src/auth/project-access.ts`):

| Role | May change |
| --- | --- |
| Management, Accounts | any project (within their permissions) |
| Project manager | projects they manage |
| Site engineer | projects they are assigned to |

Some checks need the request body, so they live in the service. For example, an engineer can submit an expense only for themselves and only on their own project (`ExpensesService.create`).

## 5. Who did it comes from the token

The daily log's author, the bill's creator, the reviewer of an engineer and the document uploader all come from the signed-in user (`@User() user: CurrentUser` in the controller), never from the request body. Nobody can sign a log "as" someone else.

Money is recorded by **Accounts only**: expenses, bills and invoices, and other project costs (`expense.create`, `bill.manage`, `project.costs.edit`). Since the people entering it are the ones who check it, a recorded expense counts at once; there is no approve/reject step.

## 6. Getting the first account in

An empty database has no one to sign in as. Run, once:

```bash
pnpm db:create-user -- --name "Your Name" --email you@company.in --role management --password 'a-strong-start'
```

That person signs in, picks their own password, and then creates everyone else's login from the Employees page. The demo data (`pnpm db:seed -- --yes`) instead gives every demo user the password `demo1234`; never seed a database real people use.

## 7. The web side

The React app does the same thing in a few small pieces. Each is worth opening:

| Piece | File | What it does |
| --- | --- | --- |
| Token store | `apps/web/src/api/http.ts` (`authToken`) | Keeps the token in `localStorage`, so a refresh keeps you signed in, and adds `Authorization: Bearer …` to every request. |
| 401 handler | `http.ts` (`setUnauthorizedHandler`) | Any 401 (token expired, login switched off) calls `logout()`, which clears the token and every cached query, and you land on the login page. |
| Who am I | `apps/web/src/auth/AuthContext.tsx` (`ApiAuthProvider`) | A TanStack Query for `GET /api/auth/me`, keyed by the token. Signing in puts the login response straight into that cache, so there is no extra request. |
| First sign-in | `features/auth/FirstPasswordScreen.tsx` | While `mustChangePassword` is true the app shows only this screen. The server refuses everything else anyway (403), so the UI just follows the server. |
| Accounts | `features/employees/EmployeeFormDialog.tsx` + `services/api/index.ts` (`syncLogin`) | "System access" on the employee form creates the login (with a starting password), changes its role, switches it off ("No login") or resets the password. |

Two things to notice:

- **React only hides; the server decides.** Hiding a button for a site engineer is about tidiness. The real rule is the `@Allow` on the route. Try it: sign in as an engineer and send a `POST /api/projects` with curl, and you get 403 whatever the UI shows.
- **Demo mode is untouched.** Without `VITE_API_BASE_URL`, `AuthProvider` renders the old `DemoAuthProvider` (pick any person, no password), so the Vercel preview still works on its own.

## Try it

```bash
curl -s localhost:3000/api/projects                     # 401 Please sign in
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"rajesh.kulkarni@aerosyshvac.in","password":"demo1234"}' | jq -r .token)
curl -s localhost:3000/api/projects -H "Authorization: Bearer $TOKEN" | jq length   # 12
```

Paste the token into [jwt.io](https://jwt.io) to see what's inside it. Then change one character and send it again: 401.
