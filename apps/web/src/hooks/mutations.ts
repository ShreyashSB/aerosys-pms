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
  reviewService,
  billService,
} from "@/services";
import type { DailyLogInput } from "@/services/dailyLogService";
import { LoginSetupError } from "@/services/api";
import type { Employee } from "@/types/models";
import { qk } from "./queries";

const NOTIFS: QueryKey = ["notifications"];

type Cached = { id: string };
/** How a mutation's result updates a cached list straight away, before the background refresh arrives. */
type CacheUpdate<TVars, TResult> =
  | { upsert: QueryKey }
  | { remove: QueryKey; id: (vars: TVars) => string }
  | ((qc: ReturnType<typeof useQueryClient>, result: TResult, vars: TVars) => void);

/**
 * Small wrapper: runs a service call, refreshes the affected resources and surfaces errors as toasts. Success toasts
 * are left to the caller because the wording depends on context.
 *
 * The save counts as done as soon as the server confirms it: the lists are refreshed in the background rather than
 * awaited, so the Save button doesn't keep spinning while whole lists download again. Where the server returns the
 * saved record, `update` puts it in the cached list right away so the screen changes at once.
 */
function useServiceMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  invalidate: QueryKey[],
  update?: CacheUpdate<TVars, TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      if (typeof update === "function") update(qc, result, vars);
      else if (update && "upsert" in update) upsertInList(qc, update.upsert, result);
      else if (update && "remove" in update) qc.setQueryData<Cached[]>(update.remove, (list) => list?.filter((x) => x.id !== update.id(vars)));
      for (const key of invalidate) void qc.invalidateQueries({ queryKey: key });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });
}

function upsertInList(qc: ReturnType<typeof useQueryClient>, key: QueryKey, result: unknown) {
  if (!result || typeof result !== "object" || !("id" in result)) return;
  const record = result as Cached;
  qc.setQueryData<Cached[]>(key, (list) => {
    if (!list) return list;
    const i = list.findIndex((x) => x.id === record.id);
    return i === -1 ? [...list, record] : list.map((x, j) => (j === i ? record : x));
  });
}

const byId = (id: string) => id;

// Projects -------------------------------------------------------------------
export const useCreateProject = () =>
  useServiceMutation(projectService.create, [qk.projects, qk.lookups, NOTIFS], { upsert: qk.projects });
export const useUpdateProject = () =>
  useServiceMutation(
    ({ id, input }: { id: string; input: Parameters<typeof projectService.update>[1] }) => projectService.update(id, input),
    [qk.projects, qk.assignments, qk.lookups, NOTIFS],
    { upsert: qk.projects },
  );
export const useSetProjectStatus = () =>
  useServiceMutation(
    ({ id, status }: { id: string; status: Parameters<typeof projectService.setStatus>[1] }) => projectService.setStatus(id, status),
    [qk.projects],
    { upsert: qk.projects },
  );
export const useDeleteProject = () =>
  useServiceMutation(projectService.remove, [
    qk.projects, qk.assignments, qk.expenses, qk.projectCosts, qk.deployments, qk.instruments,
    qk.boqItems, qk.boqExecutions, qk.dailyLogs, qk.documents, qk.bills,
  ]);

// Engineer reviews at project close -----------------------------------------
export const useSaveProjectReviews = () =>
  useServiceMutation(
    ({ projectId, reviewerId, reviews }: { projectId: string; reviewerId: string; reviews: Parameters<typeof reviewService.saveForProject>[2] }) =>
      reviewService.saveForProject(projectId, reviewerId, reviews),
    [qk.reviews],
  );

// Annexure / BOQ -------------------------------------------------------------
const BOQ: QueryKey[] = [qk.boqItems, qk.boqExecutions, NOTIFS];
export const useCreateBoqItem = () => useServiceMutation(boqService.createItem, BOQ, { upsert: qk.boqItems });
export const useUpdateBoqItem = () =>
  useServiceMutation(({ id, input }: { id: string; input: Parameters<typeof boqService.updateItem>[1] }) => boqService.updateItem(id, input), BOQ, { upsert: qk.boqItems });
export const useDeleteBoqItem = () => useServiceMutation(boqService.deleteItem, BOQ, { remove: qk.boqItems, id: byId });
export const useAddExecution = () => useServiceMutation(boqService.addExecution, BOQ, { upsert: qk.boqExecutions });
export const useDeleteExecution = () => useServiceMutation(boqService.deleteExecution, BOQ, { remove: qk.boqExecutions, id: byId });
export const useClosePeriod = () => useServiceMutation(boqService.closePeriod, [qk.projects]);

// Daily logs -----------------------------------------------------------------
export const useSaveDailyLog = () =>
  useServiceMutation(
    ({ input, actorId, logId }: { input: DailyLogInput; actorId: string; logId?: string }) => dailyLogService.save(input, actorId, logId),
    [qk.dailyLogs, qk.boqExecutions, NOTIFS],
    { upsert: qk.dailyLogs },
  );
export const useDeleteDailyLog = () =>
  useServiceMutation(dailyLogService.remove, [qk.dailyLogs, qk.boqExecutions], { remove: qk.dailyLogs, id: byId });

// Documents ------------------------------------------------------------------
export const useUploadDocument = () =>
  useServiceMutation(
    ({ input, actorId }: { input: Parameters<typeof documentService.upload>[0]; actorId: string }) => documentService.upload(input, actorId),
    [qk.documents],
    { upsert: qk.documents },
  );
export const useDeleteDocument = () => useServiceMutation(documentService.remove, [qk.documents], { remove: qk.documents, id: byId });

// Assignments ----------------------------------------------------------------
export const useAssignEngineer = () => useServiceMutation(assignmentService.assign, [qk.assignments, NOTIFS]);
export const useReleaseAssignment = () => useServiceMutation(assignmentService.release, [qk.assignments]);

// Expenses -------------------------------------------------------------------
export const useCreateExpense = () => useServiceMutation(expenseService.create, [qk.expenses], { upsert: qk.expenses });
export const useDeleteExpense = () => useServiceMutation(expenseService.remove, [qk.expenses], { remove: qk.expenses, id: byId });

// Instruments ----------------------------------------------------------------
const INS: QueryKey[] = [qk.instruments, qk.deployments];
export const useCreateInstrument = () => useServiceMutation(instrumentService.create, INS, { upsert: qk.instruments });
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
/**
 * If the employee saved but their login didn't, the save still counts (so the form closes and a second Save doesn't
 * try to add the same person again), with a warning saying the login needs another try.
 */
async function savedEvenIfLoginFailed(save: () => Promise<Employee>): Promise<Employee> {
  try {
    return await save();
  } catch (err) {
    if (!(err instanceof LoginSetupError)) throw err;
    toast.warning(`${err.employee.name} was saved, but their login wasn't`, {
      description: `${err.message}. Open them again and save to set up the login.`,
      duration: 10_000,
    });
    return err.employee;
  }
}
export const useCreateEmployee = () =>
  useServiceMutation(
    (input: Parameters<typeof employeeService.create>[0]) => savedEvenIfLoginFailed(() => employeeService.create(input)),
    [qk.employees, qk.users],
    { upsert: qk.employees },
  );
export const useUpdateEmployee = () =>
  useServiceMutation(
    ({ id, input }: { id: string; input: Parameters<typeof employeeService.update>[1] }) =>
      savedEvenIfLoginFailed(() => employeeService.update(id, input)),
    [qk.employees, qk.users],
    { upsert: qk.employees },
  );

// Project costs --------------------------------------------------------------
// Bills & invoices (Accounts) -------------------------------------------------
export const useCreateBill = () =>
  useServiceMutation(
    ({ input, actorId }: { input: Parameters<typeof billService.create>[0]; actorId: string }) => billService.create(input, actorId),
    [qk.bills],
    { upsert: qk.bills },
  );
export const useDeleteBill = () => useServiceMutation(billService.remove, [qk.bills], { remove: qk.bills, id: byId });

export const useCreateProjectCost = () => useServiceMutation(projectCostService.create, [qk.projectCosts], { upsert: qk.projectCosts });
export const useDeleteProjectCost = () =>
  useServiceMutation(projectCostService.remove, [qk.projectCosts], { remove: qk.projectCosts, id: byId });

// Notifications / settings ---------------------------------------------------
export const useMarkNotificationRead = () =>
  useServiceMutation(({ id, userId }: { id: string; userId: string }) => notificationService.markRead(id, userId), [NOTIFS]);
export const useMarkAllNotificationsRead = () => useServiceMutation(notificationService.markAllRead, [NOTIFS]);
export const useClearReadNotifications = () => useServiceMutation(notificationService.clearRead, [NOTIFS]);
export const useUpdateSettings = () => useServiceMutation(settingsService.update, [qk.settings]);
export const useResetDemoData = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsService.resetDemoData,
    onSuccess: () => qc.invalidateQueries(),
  });
};
