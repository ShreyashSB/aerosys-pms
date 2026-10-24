import { useQuery } from "@tanstack/react-query";
import {
  assignmentService,
  employeeService,
  expenseService,
  instrumentService,
  notificationService,
  projectCostService,
  boqService,
  dailyLogService,
  documentService,
  projectService,
  settingsService,
} from "@/services";
import type { User } from "@/types/models";

/** Central list of query keys – mutations invalidate by these. */
export const qk = {
  projects: ["projects"] as const,
  employees: ["employees"] as const,
  users: ["users"] as const,
  assignments: ["assignments"] as const,
  expenses: ["expenses"] as const,
  instruments: ["instruments"] as const,
  deployments: ["deployments"] as const,
  projectCosts: ["projectCosts"] as const,
  settings: ["settings"] as const,
  boqItems: ["boqItems"] as const,
  boqExecutions: ["boqExecutions"] as const,
  dailyLogs: ["dailyLogs"] as const,
  documents: ["documents"] as const,
  notifications: (userId?: string) => ["notifications", userId] as const,
};

export const useProjects = () => useQuery({ queryKey: qk.projects, queryFn: projectService.list });
export const useEmployees = () => useQuery({ queryKey: qk.employees, queryFn: employeeService.list });
export const useUsers = () => useQuery({ queryKey: qk.users, queryFn: employeeService.listUsers });
export const useAssignments = () => useQuery({ queryKey: qk.assignments, queryFn: assignmentService.list });
export const useExpenses = () => useQuery({ queryKey: qk.expenses, queryFn: expenseService.list });
export const useInstruments = () => useQuery({ queryKey: qk.instruments, queryFn: instrumentService.list });
export const useDeployments = () => useQuery({ queryKey: qk.deployments, queryFn: instrumentService.listDeployments });
export const useProjectCosts = () => useQuery({ queryKey: qk.projectCosts, queryFn: projectCostService.list });
export const useBoqItems = () => useQuery({ queryKey: qk.boqItems, queryFn: boqService.listItems });
export const useBoqExecutions = () => useQuery({ queryKey: qk.boqExecutions, queryFn: boqService.listExecutions });
export const useDailyLogs = () => useQuery({ queryKey: qk.dailyLogs, queryFn: dailyLogService.list });
export const useDocuments = () => useQuery({ queryKey: qk.documents, queryFn: documentService.list });
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: settingsService.get });

export const useNotifications = (user: User | null) =>
  useQuery({
    queryKey: qk.notifications(user?.id),
    queryFn: () => notificationService.listForUser(user!),
    enabled: !!user,
    refetchInterval: 30_000,
  });
