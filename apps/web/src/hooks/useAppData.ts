import { useMemo } from "react";
import { buildIndex, computeProjectPerformance, summarisePortfolio, type ProjectPerformance } from "@/domain/performance";
import { overallHealth, type Health } from "@/domain/health";
import { generateInsights } from "@/domain/insights";
import { DEFAULT_SETTINGS } from "@/domain/assumptions";
import { scopeProjects } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthContext";
import {
  useAssignments,
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

  const all = [projects, employees, assignments, expenses, instruments, deployments, projectCosts, settingsQ, boqItems, boqExecutions, dailyLogs, documents];
  const isLoading = all.some((q) => q.isLoading);
  const error = all.find((q) => q.error)?.error ?? null;

  const derived = useMemo(() => {
    const p = projects.data ?? [];
    const e = employees.data ?? [];
    const settings = settingsQ.data ?? DEFAULT_SETTINGS;
    const index = buildIndex({
      employees: e,
      expenses: expenses.data ?? [],
      instruments: instruments.data ?? [],
      projectInstruments: deployments.data ?? [],
      projectCosts: projectCosts.data ?? [],
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
      settings,
      index,
      perf,
      health,
      employeeById: new Map(e.map((x) => [x.id, x])),
      projectById: new Map(p.map((x) => [x.id, x])),
      instrumentById: new Map((instruments.data ?? []).map((x) => [x.id, x])),
    };
  }, [
    projects.data, employees.data, assignments.data, expenses.data, instruments.data, deployments.data,
    projectCosts.data, settingsQ.data, boqItems.data, boqExecutions.data, dailyLogs.data, documents.data,
  ]);

  return { ...derived, isLoading, error };
}

export type AppData = ReturnType<typeof useAppData>;

/** Projects visible to the signed-in user (row-level scoping) + portfolio summary & insights. */
export function useScopedData() {
  const data = useAppData();
  const { user } = useAuth();
  return useMemo(() => {
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
  }, [data, user]);
}
