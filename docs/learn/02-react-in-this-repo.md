# 02 — React in this repo

React builds the screen out of **components**: plain TypeScript functions that take inputs (props) and return markup (JSX). There are no classes, no templates in separate files and no modules to declare.

## Angular to React, side by side

| Angular | React (this repo) | Example file |
| --- | --- | --- |
| `@Component` class + HTML template | A function returning JSX | `apps/web/src/components/common/StatCard.tsx` |
| `@Input()` | Function parameters ("props") | `StatCard({ label, value, loading })` |
| `@Output()` + `EventEmitter` | A callback prop, e.g. `onSave={...}` | dialogs in `apps/web/src/features/*` |
| Component fields + change detection | `useState`: calling the setter re-renders | `ExpenseFormDialog.tsx`: `const [receipt, setReceipt] = useState(...)` |
| `ngOnInit` / `ngOnChanges` | `useEffect(() => {...}, [deps])` | |
| `*ngIf`, `*ngFor` | `{cond && <X/>}`, `{items.map(i => <Row key={i.id}/>)}` | any page |
| Injectable service + `HttpClient` | A plain module of async functions | `apps/web/src/services/*` |
| RxJS + a store for server data | **TanStack Query** (`useQuery`, `useMutation`) | `apps/web/src/hooks/queries.ts`, `mutations.ts` |
| Angular Router | React Router | `apps/web/src/App.tsx` |
| Angular Material | Radix UI + Tailwind CSS (shadcn style) | `apps/web/src/components/ui/*` |

## Read one component

```tsx
export function StatCard({ label, value, loading }: { label: string; value: ReactNode; loading?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-semibold">{value}</p>}
    </Card>
  );
}
```

- The parameters are the inputs. The returned JSX is the template.
- `{ ... }` inside JSX is a TypeScript expression. `loading ? A : B` replaces `*ngIf ... else`.
- `className` holds **Tailwind** classes: each one is a small style (`p-4` = padding, `text-2xl` = font size). You style by composing classes instead of writing CSS files.
- Use it like `<StatCard label="Projects" value={12} />`.

## Hooks: the rules

Functions whose names start with `use` are **hooks**: `useState`, `useEffect`, `useQuery`, and our own like `useProjects`.

1. Call them only at the top level of a component, never inside `if` or loops.
2. Every time state changes, React calls the component function again and redraws what changed. Treat the function as "describe the screen for the current state".

## Server data: TanStack Query

This replaces most of what you would use RxJS and a store for in Angular.

```ts
// hooks/queries.ts
export const useProjects = () => useQuery({ queryKey: ["projects"], queryFn: projectService.list });

// in a page
const { data: projects, isLoading, error } = useProjects();
```

- It fetches once, caches by `queryKey`, and shares the result with every component that asks.
- After a change (`useMutation` in `hooks/mutations.ts`), we **invalidate** the key and every screen showing projects refetches.
- `projectService.list` reads mock data today. Switching to the API means changing that one function to `http.get("/api/projects")` (see `apps/web/src/api/http.ts`). The pages do not change. That is the migration plan, one service at a time.

## Where things live in apps/web/src

```
pages/        one file per route (Dashboard, Projects, ...)
features/     forms and widgets for one area (projects, expenses, instruments)
components/   ui/ = buttons, inputs, dialogs; common/ = tables, cards; layout/ = sidebar, top bar
hooks/        useQuery / useMutation wrappers
services/     data access, REST-shaped (mock today, API tomorrow)
domain/       KPI formulas (moving to packages/core so the API can share them)
types/        the domain model
```

## Try it

In a Codespace run `pnpm dev:web`, open `apps/web/src/components/common/StatCard.tsx`, change `text-2xl` to `text-3xl` and save. The browser updates instantly (Vite hot reload).
