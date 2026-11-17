import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
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
    await this.assertCodeFree(code);
    try {
      const [row] = await this.db.insert(employees).values({ ...input, code }).returning();
      return row;
    } catch (err) {
      throw this.friendly(err);
    }
  }

  async update(id: string, input: EmployeeInput): Promise<Employee> {
    if (input.code) await this.assertCodeFree(input.code, id);
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

  /** Employee IDs are unique regardless of case, so EMP-004 and emp-004 count as the same. */
  private async assertCodeFree(code: string, exceptId?: string): Promise<void> {
    const same = sql`lower(${employees.code}) = lower(${code})`;
    const [taken] = await this.db
      .select({ code: employees.code, name: employees.name })
      .from(employees)
      .where(exceptId ? and(same, ne(employees.id, exceptId)) : same)
      .limit(1);
    if (taken) throw new ConflictException(`Employee ID ${taken.code} is already used by ${taken.name}`);
  }

  /**
   * One more than the highest number in use, keeping that ID's prefix and width
   * (EMP-007 → EMP-008); EMP-001 when there are none. The web form prefills the same.
   */
  private async nextCode(): Promise<string> {
    const rows = await this.db.select({ code: employees.code }).from(employees);
    let best = { prefix: 'EMP-', n: 0, width: 3 };
    for (const { code } of rows) {
      const m = /^(.*?)(\d+)$/.exec(code.trim());
      if (m && Number(m[2]) > best.n) best = { prefix: m[1], n: Number(m[2]), width: m[2].length };
    }
    return `${best.prefix}${String(best.n + 1).padStart(best.width, '0')}`;
  }

  private friendly(err: unknown) {
    if (isUniqueViolation(err)) return new ConflictException('An employee with this email or employee ID already exists');
    return err;
  }
}
