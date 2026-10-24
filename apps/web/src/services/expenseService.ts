import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { uid } from "@/lib/utils";
import type { Expense } from "@/types/models";

export type ExpenseInput = Pick<Expense, "employeeId" | "projectId" | "category" | "amount" | "date" | "description" | "receipt">;

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

  // POST /api/expenses  (Accounts records it; it counts towards project cost at once)
  async create(input: ExpenseInput): Promise<Expense> {
    await simulateLatency();
    validate(input);
    return db.write((data) => {
      const project = data.projects.find((p) => p.id === input.projectId);
      const emp = data.employees.find((e) => e.id === input.employeeId);
      if (!project || !emp) throw new ApiError("Project or employee not found", 404);
      const seq = Math.max(1000, ...data.expenses.map((e) => Number(e.code.split("-")[1]) || 0)) + 1;
      const expense: Expense = { ...input, id: uid("exp"), code: `EXP-${seq}`, submittedAt: new Date().toISOString() };
      data.expenses.unshift(expense);
      return clone(expense);
    });
  },

  // DELETE /api/expenses/:id (to correct a wrong entry)
  async remove(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      if (!data.expenses.some((x) => x.id === id)) throw new ApiError("Expense not found", 404);
      data.expenses = data.expenses.filter((x) => x.id !== id);
    });
  },
};
