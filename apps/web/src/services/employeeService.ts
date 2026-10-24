import { ApiError, clone, db, simulateLatency } from "@/api/mockDb";
import { uid } from "@/lib/utils";
import type { Employee, Role, User } from "@/types/models";

export type EmployeeInput = Omit<Employee, "id" | "code"> & { code?: string; appRole: Role | null };

function validate(input: EmployeeInput) {
  if (!input.name.trim()) throw new ApiError("Name is required");
  if (!/^\S+@\S+\.\S+$/.test(input.email)) throw new ApiError("A valid email is required");
  if (!(input.dailyCost >= 0)) throw new ApiError("Daily cost cannot be negative");
}

function syncUser(users: User[], emp: Employee, role: Role | null) {
  const existing = users.find((u) => u.employeeId === emp.id);
  if (!role) {
    if (existing) users.splice(users.indexOf(existing), 1);
    return;
  }
  if (existing) {
    existing.role = role;
    existing.email = emp.email;
  } else users.push({ id: uid("usr"), employeeId: emp.id, role, email: emp.email });
}

export const employeeService = {
  // GET /api/employees
  async list(): Promise<Employee[]> {
    await simulateLatency();
    return clone(db.read().employees);
  },

  // GET /api/users
  async listUsers(): Promise<User[]> {
    await simulateLatency(50, 120);
    return clone(db.read().users);
  },

  async create(input: EmployeeInput): Promise<Employee> {
    await simulateLatency();
    validate(input);
    return db.write((data) => {
      if (data.employees.some((e) => e.email.toLowerCase() === input.email.toLowerCase()))
        throw new ApiError("An employee with this email already exists");
      const { appRole, code, ...rest } = input;
      const nextNo = Math.max(100, ...data.employees.map((e) => Number(e.code.split("-")[1]) || 0)) + 1;
      const emp: Employee = { ...rest, id: uid("emp"), code: code?.trim() || `AHV-${nextNo}` };
      data.employees.push(emp);
      syncUser(data.users, emp, appRole);
      return clone(emp);
    });
  },

  async update(id: string, input: EmployeeInput): Promise<Employee> {
    await simulateLatency();
    validate(input);
    return db.write((data) => {
      const emp = data.employees.find((e) => e.id === id);
      if (!emp) throw new ApiError("Employee not found", 404);
      const { appRole, code, ...rest } = input;
      Object.assign(emp, rest);
      if (code?.trim()) emp.code = code.trim();
      syncUser(data.users, emp, appRole);
      return clone(emp);
    });
  },
};
