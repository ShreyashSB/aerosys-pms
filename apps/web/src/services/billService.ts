import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { uid } from "@/lib/utils";
import type { ProjectBill } from "@/types/models";

export type BillInput = Pick<ProjectBill, "projectId" | "kind" | "number" | "party" | "amount" | "date" | "attachment" | "notes">;

function validate(input: BillInput) {
  if (!input.number.trim()) throw new ApiError("Bill / invoice number is required");
  if (!input.party.trim()) throw new ApiError(input.kind === "vendor_bill" ? "Vendor is required" : "Client is required");
  if (!(input.amount > 0)) throw new ApiError("Amount must be greater than zero");
  if (!input.date) throw new ApiError("Date is required");
  if (input.attachment && input.attachment.size > 10 * 1024 * 1024) throw new ApiError("Attachment must be smaller than 10 MB");
}

export const billService = {
  // GET /api/bills
  async list(): Promise<ProjectBill[]> {
    await simulateLatency();
    return clone(db.read().bills);
  },

  // POST /api/projects/:id/bills (Accounts and Management)
  async create(input: BillInput, actorId: string): Promise<ProjectBill> {
    await simulateLatency();
    validate(input);
    return db.write((data) => {
      if (!data.projects.some((p) => p.id === input.projectId)) throw new ApiError("Project not found", 404);
      const kindLabel = input.kind === "vendor_bill" ? "vendor bill" : "invoice";
      if (data.bills.some((b) => b.projectId === input.projectId && b.kind === input.kind && b.number.toLowerCase() === input.number.trim().toLowerCase()))
        throw new ApiError(`This ${kindLabel} number is already recorded on the project`);
      const bill: ProjectBill = { ...input, number: input.number.trim(), party: input.party.trim(), notes: input.notes.trim(), id: uid("bill"), createdById: actorId, createdAt: new Date().toISOString() };
      data.bills.unshift(bill);
      return clone(bill);
    });
  },

  // DELETE /api/bills/:id
  async remove(id: string): Promise<void> {
    await simulateLatency();
    db.write((data) => {
      data.bills = data.bills.filter((b) => b.id !== id);
    });
  },
};
