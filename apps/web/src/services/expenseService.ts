import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { formatINR } from "@/lib/format";
import { uid } from "@/lib/utils";
import type { Expense } from "@/types/models";
import { pushNotification } from "./notificationService";

export type ExpenseInput = Pick<Expense, "employeeId" | "projectId" | "category" | "amount" | "date" | "description" | "receipt"> & {
  dailyLogId?: string | null;
};

function validate(input: ExpenseInput) {
  if (!(input.amount > 0)) throw new ApiError("Amount must be greater than zero");
  if (!input.projectId) throw new ApiError("Project is required");
  if (!input.employeeId) throw new ApiError("Employee is required");
}

export const expenseService = {
  // GET /api/expenses
  async list(): Promise<Expense[]> {
    await simulateLatency();
    return clone(db.read().expenses);
  },

  // POST /api/expenses  (always enters the approval queue as "pending")
  async create(input: ExpenseInput): Promise<Expense> {
    await simulateLatency();
    validate(input);
    return db.write((data) => {
      const project = data.projects.find((p) => p.id === input.projectId);
      const emp = data.employees.find((e) => e.id === input.employeeId);
      if (!project || !emp) throw new ApiError("Project or employee not found", 404);
      const seq = Math.max(1000, ...data.expenses.map((e) => Number(e.code.split("-")[1]) || 0)) + 1;
      const expense: Expense = {
        ...input,
        dailyLogId: input.dailyLogId ?? null,
        id: uid("exp"),
        code: `EXP-${seq}`,
        status: "pending",
        submittedAt: new Date().toISOString(),
        reviewedById: null,
        reviewedAt: null,
        reviewNote: "",
      };
      data.expenses.unshift(expense);
      pushNotification(data, {
        type: "expense_submitted",
        title: "Expense submitted for approval",
        message: `${emp.name} submitted ${expense.category} expense of ${formatINR(expense.amount)} on ${project.name}.`,
        link: `/expenses?status=pending`,
        audienceRoles: ["management", "accounts"],
        audienceEmployeeIds: [project.managerId],
      });
      return clone(expense);
    });
  },

  async approve(id: string, reviewerId: string, note = ""): Promise<Expense> {
    return review(id, reviewerId, "approved", note);
  },

  async reject(id: string, reviewerId: string, note: string): Promise<Expense> {
    if (!note.trim()) throw new ApiError("Please provide a reason for rejection");
    return review(id, reviewerId, "rejected", note);
  },

  // DELETE /api/expenses/:id (only pending expenses can be withdrawn)
  async remove(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      const e = data.expenses.find((x) => x.id === id);
      if (!e) throw new ApiError("Expense not found", 404);
      if (e.status !== "pending") throw new ApiError("Only pending expenses can be withdrawn");
      data.expenses = data.expenses.filter((x) => x.id !== id);
    });
  },
};

async function review(id: string, reviewerId: string, status: "approved" | "rejected", note: string) {
  await simulateLatency();
  return db.write((data) => {
    const e = data.expenses.find((x) => x.id === id);
    if (!e) throw new ApiError("Expense not found", 404);
    if (e.status !== "pending") throw new ApiError(`Expense has already been ${e.status}`);
    const project = data.projects.find((p) => p.id === e.projectId);
    const reviewer = data.employees.find((x) => x.id === reviewerId);
    e.status = status;
    e.reviewedById = reviewerId;
    e.reviewedAt = new Date().toISOString();
    e.reviewNote = note;
    pushNotification(data, {
      type: status === "approved" ? "expense_approved" : "expense_rejected",
      title: status === "approved" ? "Expense approved" : "Expense rejected",
      message:
        `${e.code} (${e.category}, ${formatINR(e.amount)}) on ${project?.name ?? "project"} was ${status}` +
        `${reviewer ? ` by ${reviewer.name}` : ""}${note ? ` – “${note}”` : ""}.`,
      link: `/expenses`,
      audienceRoles: status === "approved" ? ["accounts"] : [],
      audienceEmployeeIds: [e.employeeId],
    });
    return clone(e);
  });
}
