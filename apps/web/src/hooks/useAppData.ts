import { useMemo } from "react";
import { buildIndex, computeProjectPerformance, summarisePortfolio, type ProjectPerformance } from "@/domain/performance";
import { overallHealth, type Health } from "@/domain/health";
import { generateInsights } from "@/domain/insights";
import { DEFAULT_SETTINGS } from "@/domain/assumptions";
import { scopeProjects } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthContext";
import {
  useAssignments,
  useBills,
  useBoqExecutions,
  useBoqItems,
  useDailyLogs,
  useDeployments,
  useDocuments,
  useEmployees,
  useExpenses,
  useInstruments,
  useProjectCosts,
  useProjects,
  useReviews,
  useSettings,
} from "./queries";

/**
 * Joins the independent resources and derives performance for every project
 * through the central engine (src/domain). Components read from here instead
 * of stitching relationships or re-implementing formulas themselves, so every
 * screen shows the same numbers.
 */
export function useAppData() {
  const projects = useProjects();
  const employees = useEmployees();
  const assignments = useAssignments();
  const expenses = useExpenses();
  const instruments = useInstruments();
  const deployments = useDeployments();
  const projectCosts = useProjectCosts();
  const settingsQ = useSettings();
  const boqItems = useBoqItems();
  const boqExecutions = useBoqExecutions();
  const dailyLogs = useDailyLogs();
  const documents = useDocuments();
  const reviews = useReviews();
  const bills = useBills();

  const byName = { projects, employees, assignments, expenses, instruments, deployments, projectCosts, settings: settingsQ, boqItems, boqExecutions, dailyLogs, documents, reviews, bills };
  const all = Object.values(byName);
  const isLoading = all.some((q) => q.isLoading);
  // Pages that only show a few lists wait for just those (via waitingFor) instead of all 14, so e.g. Expenses
  // appears as soon as expenses, projects, employees and assignments arrive.
  const loadingKey = all.map((q) => (q.isLoading ? 1 : 0)).join("");
  const waitingFor = useMemo(() => {
    const loading = new Set(Object.entries(byName).filter(([, q]) => q.isLoading).map(([k]) => k as Resource));
    return (...resources: Resource[]) => resources.some((r) => loading.has(r));
  }, [loadingKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const error = all.find((q) => q.error)?.error ?? null;
  // Like waitingFor: a page shows an error only when a list it actually uses failed, and can retry just the failed ones.
  const errorKey = all.map((q) => (q.error ? 1 : 0)).join("");
  const { errorFor, retry } = useMemo(() => {
    const failed = Object.entries(byName).filter(([, q]) => q.error);
    return {
      errorFor: (...resources: Resource[]) => failed.find(([k]) => resources.includes(k as Resource))?.[1].error ?? null,
      retry: () => failed.forEach(([, q]) => void q.refetch()),
    };
  }, [errorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputs = [
    projects.data, employees.data, assignments.data, expenses.data, instruments.data, deployments.data,
    projectCosts.data, settingsQ.data, boqItems.data, boqExecutions.data, dailyLogs.data, documents.data, reviews.data, bills.data,
  ];
  // Shared across every component that calls this hook: the performance engine runs once per data change, not once
  // per page or widget that mounts (which made every page switch redo the whole portfolio calculation).
  const derived = useMemo(() => sharedDerived(inputs, () => {
    const p = projects.data ?? [];
    const e = employees.data ?? [];
    const settings = settingsQ.data ?? DEFAULT_SETTINGS;
    const index = buildIndex({
      employees: e,
      expenses: expenses.data ?? [],
      instruments: instruments.data ?? [],
      projectInstruments: deployments.data ?? [],
      projectCosts: projectCosts.data ?? [],
      bills: bills.data ?? [],
      boqItems: boqItems.data ?? [],
      boqExecutions: boqExecutions.data ?? [],
      dailyLogs: dailyLogs.data ?? [],
    });
    const perf = new Map<string, ProjectPerformance>();
    const health = new Map<string, Health>();
    for (const project of p) {
      const f = computeProjectPerformance(project, index, settings);
      perf.set(project.id, f);
      health.set(project.id, overallHealth(f, project, settings));
    }
    return {
      projects: p,
      employees: e,
      assignments: assignments.data ?? [],
      expenses: expenses.data ?? [],
      instruments: instruments.data ?? [],
      deployments: deployments.data ?? [],
      projectCosts: projectCosts.data ?? [],
      boqItems: boqItems.data ?? [],
      boqExecutions: boqExecutions.data ?? [],
      dailyLogs: dailyLogs.data ?? [],
      documents: documents.data ?? [],
      reviews: reviews.data ?? [],
      bills: bills.data ?? [],
      settings,
      index,
      perf,
      health,
      employeeById: new Map(e.map((x) => [x.id, x])),
      projectById: new Map(p.map((x) => [x.id, x])),
      instrumentById: new Map((instruments.data ?? []).map((x) => [x.id, x])),
    };
  }), inputs); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => ({ ...derived, isLoading, waitingFor, error, errorFor, retry }), [derived, isLoading, waitingFor, error, errorFor, retry]);
}

export type Resource =
  | "projects" | "employees" | "assignments" | "expenses" | "instruments" | "deployments" | "projectCosts"
  | "settings" | "boqItems" | "boqExecutions" | "dailyLogs" | "documents" | "reviews" | "bills";

/** One-entry cache: returns the last result while every input is the same object as last time. */
function oneEntryCache<T>() {
  let lastInputs: unknown[] | null = null;
  let lastValue: T;
  return (inputs: unknown[], compute: () => T): T => {
    if (lastInputs && lastInputs.length === inputs.length && lastInputs.every((v, i) => v === inputs[i])) return lastValue;
    lastValue = compute();
    lastInputs = inputs;
    return lastValue;
  };
}
const sharedDerived = oneEntryCache<Record<string, unknown>>() as <T>(inputs: unknown[], compute: () => T) => T;
const sharedScoped = oneEntryCache<unknown>() as <T>(inputs: unknown[], compute: () => T) => T;

export type AppData = ReturnType<typeof useAppData>;

/** Projects visible to the signed-in user (row-level scoping) + portfolio summary & insights. */
export function useScopedData() {
  const data = useAppData();
  const { user } = useAuth();
  // Shared like useAppData: scoping, the portfolio summary and insights are computed once per data or user change.
  return useMemo(() => sharedScoped([data, user], () => {
    const projects = user ? scopeProjects(user, data.projects, data.assignments) : [];
    const ids = new Set(projects.map((p) => p.id));
    const isEngineer = user?.role === "site_engineer";
    const expenses = user
      ? data.expenses.filter((e) =>
          user.role === "management" || user.role === "accounts"
            ? true
            : isEngineer
              ? e.employeeId === user.employeeId
              : ids.has(e.projectId) || e.employeeId === user.employeeId,
        )
      : [];
    const instruments = user ? data.instruments.filter((i) => (isEngineer ? i.assignedEngineerId === user.employeeId : true)) : [];
    return {
      ...data,
      scopedProjects: projects,
      scopedProjectIds: ids,
      scopedExpenses: expenses,
      scopedInstruments: instruments,
      portfolio: summarisePortfolio(projects, data.perf),
      insights: generateInsights(projects, data.perf, data.settings),
    };
  }), [data, user]);
}
