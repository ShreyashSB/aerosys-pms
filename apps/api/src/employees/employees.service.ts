import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { isUniqueViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { employees, type Employee } from '../db/schema.js';
import type { EmployeeInput } from './employees.dto.js';

@Injectable()
export class EmployeesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(): Promise<Employee[]> {
    return this.db.select().from(employees).orderBy(asc(employees.code));
  }

  async get(id: string): Promise<Employee> {
    const [row] = await this.db.select().from(employees).where(eq(employees.id, id));
    if (!row) throw new NotFoundException('Employee not found');
    return row;
  }

  async create(input: EmployeeInput): Promise<Employee> {
    const code = input.code ?? (await this.nextCode());
    try {
      const [row] = await this.db.insert(employees).values({ ...input, code }).returning();
      return row;
    } catch (err) {
      throw this.friendly(err);
    }
  }

  async update(id: string, input: EmployeeInput): Promise<Employee> {
    try {
      const [row] = await this.db
        .update(employees)
        // Keep the current code when the form leaves it out.
        .set({ ...input, code: input.code ?? undefined })
        .where(eq(employees.id, id))
        .returning();
      if (!row) throw new NotFoundException('Employee not found');
      return row;
    } catch (err) {
      throw this.friendly(err);
    }
  }

  /** EMP-001, EMP-002, … one more than the highest number in use. */
  private async nextCode(): Promise<string> {
    const rows = await this.db.select({ code: employees.code }).from(employees);
    const max = Math.max(0, ...rows.map((r) => Number(r.code.split('-').pop()) || 0));
    return `EMP-${String(max + 1).padStart(3, '0')}`;
  }

  private friendly(err: unknown) {
    if (isUniqueViolation(err)) return new ConflictException('An employee with this email or employee code already exists');
    return err;
  }
}
