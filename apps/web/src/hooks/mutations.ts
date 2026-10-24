import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  assignmentService,
  employeeService,
  expenseService,
  instrumentService,
  notificationService,
  projectCostService,
  projectService,
  settingsService,
  boqService,
  dailyLogService,
  documentService,
} from "@/services";
import type { DailyLogInput } from "@/services/dailyLogService";
import { qk } from "./queries";

const NOTIFS: QueryKey = ["notifications"];

/**
 * Small wrapper: runs a service call, invalidates the affected resources and
 * surfaces errors as toasts. Success toasts are left to the caller because the
 * wording depends on context.
 */
function useServiceMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, invalidate: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(invalidate.map((key) => qc.invalidateQueries({ queryKey: key }))),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });
}

// Projects -------------------------------------------------------------------
export const useCreateProject = () =>
  useServiceMutation(projectService.create, [qk.projects, NOTIFS]);
export const useUpdateProject = () =>
  useServiceMutation(
    ({ id, input }: { id: string; input: Parameters<typeof projectService.update>[1] }) => projectService.update(id, input),
    [qk.projects, qk.assignments, NOTIFS],
  );
export const useSetProjectStatus = () =>
  useServiceMutation(
    ({ id, status }: { id: string; status: Parameters<typeof projectService.setStatus>[1] }) => projectService.setStatus(id, status),
    [qk.projects],
  );
export const useDeleteProject = () =>
  useServiceMutation(projectService.remove, [
    qk.projects, qk.assignments, qk.expenses, qk.projectCosts, qk.deployments, qk.instruments,
    qk.boqItems, qk.boqExecutions, qk.dailyLogs, qk.documents,
  ]);

// Annexure / BOQ -------------------------------------------------------------
const BOQ: QueryKey[] = [qk.boqItems, qk.boqExecutions, NOTIFS];
export const useCreateBoqItem = () => useServiceMutation(boqService.createItem, BOQ);
export const useUpdateBoqItem = () =>
  useServiceMutation(({ id, input }: { id: string; input: Parameters<typeof boqService.updateItem>[1] }) => boqService.updateItem(id, input), BOQ);
export const useDeleteBoqItem = () => useServiceMutation(boqService.deleteItem, BOQ);
export const useAddExecution = () => useServiceMutation(boqService.addExecution, BOQ);
export const useDeleteExecution = () => useServiceMutation(boqService.deleteExecution, BOQ);
export const useClosePeriod = () => useServiceMutation(boqService.closePeriod, [qk.projects]);

// Daily logs -----------------------------------------------------------------
export const useSaveDailyLog = () =>
  useServiceMutation(
    ({ input, actorId, logId }: { input: DailyLogInput; actorId: string; logId?: string }) => dailyLogService.save(input, actorId, logId),
    [qk.dailyLogs, qk.boqExecutions, qk.expenses, NOTIFS],
  );
export const useDeleteDailyLog = () => useServiceMutation(dailyLogService.remove, [qk.dailyLogs, qk.boqExecutions, qk.expenses]);

// Documents ------------------------------------------------------------------
export const useUploadDocument = () =>
  useServiceMutation(
    ({ input, actorId }: { input: Parameters<typeof documentService.upload>[0]; actorId: string }) => documentService.upload(input, actorId),
    [qk.documents],
  );
export const useDeleteDocument = () => useServiceMutation(documentService.remove, [qk.documents]);

// Assignments ----------------------------------------------------------------
export const useAssignEngineer = () => useServiceMutation(assignmentService.assign, [qk.assignments, NOTIFS]);
export const useReleaseAssignment = () => useServiceMutation(assignmentService.release, [qk.assignments]);

// Expenses -------------------------------------------------------------------
export const useCreateExpense = () => useServiceMutation(expenseService.create, [qk.expenses, NOTIFS]);
export const useApproveExpense = () =>
  useServiceMutation(
    ({ id, reviewerId, note }: { id: string; reviewerId: string; note?: string }) => expenseService.approve(id, reviewerId, note),
    [qk.expenses, NOTIFS],
  );
export const useRejectExpense = () =>
  useServiceMutation(
    ({ id, reviewerId, note }: { id: string; reviewerId: string; note: string }) => expenseService.reject(id, reviewerId, note),
    [qk.expenses, NOTIFS],
  );
export const useDeleteExpense = () => useServiceMutation(expenseService.remove, [qk.expenses]);

// Instruments ----------------------------------------------------------------
const INS: QueryKey[] = [qk.instruments, qk.deployments];
export const useCreateInstrument = () => useServiceMutation(instrumentService.create, INS);
export const useUpdateInstrument = () =>
  useServiceMutation(
    ({ id, input }: { id: string; input: Parameters<typeof instrumentService.update>[1] }) => instrumentService.update(id, input),
    INS,
  );
export const useAssignInstrument = () =>
  useServiceMutation(
    ({ id, engineerId, projectId }: { id: string; engineerId: string; projectId: string }) =>
      instrumentService.assign(id, engineerId, projectId),
    [...INS, NOTIFS],
  );
export const useReturnInstrument = () => useServiceMutation(instrumentService.returnInstrument, INS);
export const useSetInstrumentStatus = () =>
  useServiceMutation(
    ({ id, status, notes }: { id: string; status: Parameters<typeof instrumentService.setStatus>[1]; notes?: string }) =>
      instrumentService.setStatus(id, status, notes),
    INS,
  );

// Employees ------------------------------------------------------------------
export const useCreateEmployee = () => useServiceMutation(employeeService.create, [qk.employees, qk.users]);
export const useUpdateEmployee = () =>
  useServiceMutation(
    ({ id, input }: { id: string; input: Parameters<typeof employeeService.update>[1] }) => employeeService.update(id, input),
    [qk.employees, qk.users],
  );

// Project costs --------------------------------------------------------------
export const useCreateProjectCost = () => useServiceMutation(projectCostService.create, [qk.projectCosts]);
export const useDeleteProjectCost = () => useServiceMutation(projectCostService.remove, [qk.projectCosts]);

// Notifications / settings ---------------------------------------------------
export const useMarkNotificationRead = () =>
  useServiceMutation(({ id, userId }: { id: string; userId: string }) => notificationService.markRead(id, userId), [NOTIFS]);
export const useMarkAllNotificationsRead = () => useServiceMutation(notificationService.markAllRead, [NOTIFS]);
export const useUpdateSettings = () => useServiceMutation(settingsService.update, [qk.settings]);
export const useResetDemoData = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsService.resetDemoData,
    onSuccess: () => qc.invalidateQueries(),
  });
};
