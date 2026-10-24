import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { CurrentUser } from '../auth/current-user.js';
import { hashPassword } from '../auth/password.js';
import { isForeignKeyViolation, isUniqueViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { employees, users } from '../db/schema.js';
import type { CreateUserInput, ResetPasswordInput, UpdateUserInput, UserDto } from './users.dto.js';

/** Sign-in accounts, managed from the Employees page. */
@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private select() {
    return this.db
      .select({
        id: users.id,
        employeeId: users.employeeId,
        role: users.role,
        email: employees.email,
        active: users.active,
        mustChangePassword: users.mustChangePassword,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .innerJoin(employees, eq(users.employeeId, employees.id))
      .$dynamic();
  }

  list(): Promise<UserDto[]> {
    return this.select().orderBy(asc(employees.name));
  }

  private async get(id: string): Promise<UserDto> {
    const [row] = await this.select().where(eq(users.id, id));
    if (!row) throw new NotFoundException('Account not found');
    return row;
  }

  async create(actor: CurrentUser, input: CreateUserInput): Promise<UserDto> {
    guardManagement(actor, input.role);
    try {
      const [row] = await this.db
        .insert(users)
        .values({ employeeId: input.employeeId, role: input.role, passwordHash: await hashPassword(input.password) })
        .returning({ id: users.id });
      return this.get(row.id);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('This employee already has a login');
      if (isForeignKeyViolation(err)) throw new BadRequestException('Employee not found');
      throw err;
    }
  }

  async update(actor: CurrentUser, id: string, input: UpdateUserInput): Promise<UserDto> {
    const current = await this.get(id);
    guardManagement(actor, current.role, input.role);
    if (id === actor.id && (!input.active || input.role !== actor.role)) {
      throw new BadRequestException("You can't change your own role or switch off your own login");
    }
    await this.db.update(users).set(input).where(eq(users.id, id));
    return this.get(id);
  }

  /** Sets a temporary password; the person must pick a new one at next sign-in. */
  async resetPassword(actor: CurrentUser, id: string, { password }: ResetPasswordInput): Promise<UserDto> {
    guardManagement(actor, (await this.get(id)).role);
    await this.db.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: true }).where(eq(users.id, id));
    return this.get(id);
  }
}

/** Accounts can manage logins too, but only Management can create or change a Management login. */
function guardManagement(actor: CurrentUser, ...roles: string[]) {
  if (actor.role !== 'management' && roles.includes('management')) {
    throw new ForbiddenException('Only Management can manage Management logins');
  }
}
