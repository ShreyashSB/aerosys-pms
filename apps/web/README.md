# Web app: Aerosys HVAC — Project Performance, Cost Control & Profitability (prototype)

A functional web prototype of Aerosys HVAC's internal system. It is built to answer one question for management:

> **Are we executing our projects efficiently, and are we actually making money on them?**

It links four layers so that each one feeds the next:

```
WORK ORDER → ANNEXURE / BOQ → EXECUTED QUANTITY → EXECUTED VALUE → PROGRESS → EARNED VALUE
DAILY WORK LOGS → CONSUMED MAN-DAYS / IDLE DAYS → WAGES → RUNNING PPI
WAGES + EXPENSES + OVERHEAD + INSTRUMENT + MANAGEMENT → COST TO DATE → PROJECTED FINAL COST → PROJECTED PROFIT
```

It runs entirely in the browser. Realistic sample data is seeded on first load and persisted to
`localStorage`, so changes survive a refresh. No backend is required.

## Running it

From the repo root (see the root README for the full setup):

```bash
pnpm install
pnpm dev:web       # http://localhost:5173
pnpm --filter @aerosys/web build
```

The app still runs on its own mock data in localStorage; screens move to the real API one at a time.

## Deploying to Vercel

In Vercel: **Add New -> Project** and import the repo, leaving Root Directory empty.
The root `vercel.json` installs the workspace with pnpm, builds this app and serves `apps/web/dist`,
rewriting every route to `index.html` so deep links work.
Set `VITE_API_BASE_URL` once screens start calling the API.

## Demo walkthrough (about 10 minutes)

1. **Sign in as Management.** The dashboard shows contract value, earned value, actual cost, projected
   final cost and projected profit. Click **Projected profit** to see the portfolio P&L. **Attention required**
   lists observations generated from the data, such as *"Apex Pharma … consumed 50% of allotted man-days but
   is only 36% complete"*. The **Project financial health** table colour-codes every project; the
   *At risk / Over budget / Below baseline* cards filter it.
2. **Open *Phoenix Mall HVAC Retrofit*** (healthy). The Overview shows 12 health-coded KPIs. Click **PPI** or
   **Running PPI** to see the equation behind each number. Click **Financial health** for the full P&L:
   contract value → cost heads → cost to date → earned value → projected remaining cost → projected profit.
3. **Annexure / BOQ tab.** On *Installation of Air Handling Unit*, choose **Update execution** and record
   3 Nos. Return to Overview: progress, earned value and Running PPI have all moved.
4. **New daily log.** The team is pre-filled from assignments. Mark one person **Idle** with the reason
   *Site not ready*, add a work line against a BOQ item, and add a small expense. The preview shows the
   man-days, idle days and work value the log will add. Save it, and consumed man-days, idle days, wages and
   progress update.
5. **Expenses tab → Approve** the expense you just added. Consumed expenses, cost to date and projected
   profit update.
6. **Performance tab** shows PPI vs Running PPI, plan vs actual (progress, man-days, expenses, cost),
   cumulative earned value vs cost, man-day burn, and idle days by reason.
7. **Employees → edit Vikram Patil → change Daily Cost.** Wages on every project he worked on are
   re-priced immediately.
8. **Compare the other projects:** *Orchid IT Park* (efficient: high progress, low man-days),
   *GreenTech* (expenses running well ahead of progress), *Sunrise Tower* (high idle time),
   *Apex Pharma* (low Running PPI), *Metro Hospital* (low projected margin), and *Blue Ridge* / *Horizon* (completed).
9. **Switch roles** with the Demo role selector. A Site Engineer sees execution metrics but no wages,
   costs or profit. A Project Manager only sees and logs their own projects.

## Roles

| Role | Can see / do |
| --- | --- |
| Management | Everything: all projects, costs, profit, daily cost rates, reports, approvals, BOQ, daily logs, settings |
| Project Manager | Own projects: daily logs, BOQ/execution, engineer assignment, expense approval, instruments, costs |
| Site Engineer | Assigned projects' execution metrics (progress, man-days, idle, PPI) but no wages, costs or profit; own expenses & instruments |
| Accounts | All projects' costs and profitability, all expenses (view), employees and daily cost rates, financial reports |

Permissions live in `src/auth/permissions.ts`. The UI reads capability flags such as `can("expense.approve")`,
and project rows are scoped per user by `scopeProjects()`.

## Business rules & assumptions

Every formula lives in **one place**: `src/domain/assumptions.ts`. Rules that Aerosys has not yet
confirmed are marked `DEMO ASSUMPTION` there, and the adjustable ones can be changed in **Settings**
without code. Components never re-implement formulas. They read results from `src/domain/performance.ts`
and explanations from `src/domain/explain.ts`, so the calculation drawers can never disagree with the KPIs.

| Metric | Formula | Status |
| --- | --- | --- |
| PPI | Work Order Value ÷ Allotted Man-Days | Working hypothesis |
| Progress | Σ(executed qty × rate) ÷ Σ(BOQ contract amount) — value-weighted | Demo model |
| Earned value | Work Order Value × Progress | |
| Running PPI | Earned Value ÷ Consumed Man-Days | Demo assumption |
| Consumed man-days | On-site, off-site and idle entries = 1 MD each; weekly off, holiday and leave = 0 | |
| Idle days | Σ idle person-days + partial idle hours ÷ *working hours per man-day* (Settings) | |
| Wages | Consumed MD × employee **Daily Cost** (current rate; not derived from salary or CTC) | Demo assumption |
| Expenses | Approved expenses only (pending ones are shown separately) | |
| Overhead | *x*% of wages (Settings, default 20%) | Demo assumption |
| Instrument charges | Per-day value × days deployed; per-day value = asset value ÷ days from purchase to end of life | From Aerosys costing sheet |
| Management charges | *x*% of earned value (Settings, default 3%) | Demo assumption |
| Projected final cost | *Performance:* cost to date ÷ progress, or *budget:* cost to date + budget × (1 − progress) (Settings). Uses the budget method below 10% progress. | Estimate |
| Plan to date | Linear between start and expected completion (drives expected progress and planned MD/expenses) | Demo assumption |

**KPI colours** (green = healthy, amber = needs attention, red = concerning, neutral = informational) use
thresholds in `HEALTH_THRESHOLDS` (same file) plus the target margin in Settings. Consumption metrics are
judged against progress. For example, having used 58% of the man-days at 64% progress is healthy.

## Architecture

```
src/
  types/models.ts        Domain model: User, Employee, Project, ProjectAssignment, BoqItem, BoqExecution,
                         DailyLog (+ attendance), Expense, Instrument, ProjectInstrument, ProjectCost,
                         ProjectDocument, AppNotification, AppSettings
  api/
    seed.ts              Realistic, internally consistent sample data (dates relative to today)
    mockDb.ts            localStorage "database" + simulated network latency
    http.ts              Stub HTTP client for the future REST backend
  services/              Data-access layer, one module per resource (REST-shaped, async)
  domain/
    assumptions.ts       ALL business formulas, demo assumptions & health thresholds
    performance.ts       Project/portfolio engine: BOQ → progress → EV, logs → MD/idle/wages, costs, projection
    health.ts            Green / amber / red / neutral classification of KPIs
    explain.ts           Equation-style "how is this calculated" for each key metric
    insights.ts          "Attention required" observations
  auth/                  Session, demo role switching, permissions & row-level scoping
  hooks/
    queries.ts           TanStack Query hooks per resource
    mutations.ts         Mutations with cache invalidation + error toasts
    useAppData.ts        Joins resources and derives financials for the UI
  components/
    ui/                  Button, Input/Select, Dialog/Drawer, Tabs, Dropdown, Badge, Card…
    common/              DataTable (sort + paging), filters, empty/error states, confirm dialog…
    layout/              App shell, collapsible sidebar, top bar, global search, notification center
  features/              Forms and widgets per module (projects, expenses, instruments, employees, dashboard)
  pages/                 Route-level pages (code-split)
```

**Tech:** React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI primitives (shadcn-style components),
TanStack Query, React Router, Recharts, Sonner toasts, lucide icons.

### Connecting a real backend

Components never touch storage directly. They go through `src/services/*`, whose methods already match REST endpoints:

| Service method | Endpoint |
| --- | --- |
| `projectService.list / get / create / update / remove` | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id` |
| `assignmentService.assign / release` | `POST /api/projects/:id/assignments`, `DELETE /api/assignments/:id` |
| `boqService.createItem / addExecution / closePeriod` | `POST /api/projects/:id/boq-items`, `POST /api/boq-items/:id/executions`, … |
| `dailyLogService.save / remove` | `POST /api/projects/:id/daily-logs`, `PUT/DELETE /api/daily-logs/:id` |
| `expenseService.create / approve / reject` | `POST /api/expenses`, `POST /api/expenses/:id/approve`, `…/reject` |
| `instrumentService.assign / returnInstrument / setStatus` | `POST /api/instruments/:id/assign`, `…/return`, `PATCH …/status` |

To connect a backend, replace each method body with a call through `src/api/http.ts`. For example,
`list: () => http.get<Project[]>("/api/projects")`. Pages, forms and hooks stay as they are.
Business side effects that currently run in the mock services, such as notifications and closing
assignments when a project completes, would move to the server.

## Out of scope for Phase 1

Payroll, GST/tax, full accounting, procurement/inventory ERP, CRM, advanced HR, native mobile apps and AI features.
