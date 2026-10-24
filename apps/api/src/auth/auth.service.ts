import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, ne, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { employees, users } from '../db/schema.js';
import type { ChangePasswordInput, LoginInput } from './auth.dto.js';
import type { CurrentUser } from './current-user.js';
import { hashPassword, verifyPassword } from './password.js';
import type { Role } from './permissions.js';

/** A hash of nothing in particular: checked when the email is unknown, so both cases take the same time. */
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  private selectUser() {
    return this.db
      .select({
        id: users.id,
        employeeId: users.employeeId,
        role: users.role,
        email: employees.email,
        name: employees.name,
        mustChangePassword: users.mustChangePassword,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .innerJoin(employees, eq(users.employeeId, employees.id))
      .$dynamic();
  }

  /** An account that may sign in: active, and its employee not marked inactive. */
  async findActive(userId: string): Promise<CurrentUser | null> {
    const [row] = await this.selectUser().where(and(eq(users.id, userId), eq(users.active, true), ne(employees.status, 'inactive')));
    return row ? toCurrentUser(row) : null;
  }

  async login({ email, password }: LoginInput): Promise<{ token: string; user: CurrentUser }> {
    const [row] = await this.selectUser().where(
      and(sql`lower(${employees.email}) = ${email}`, eq(users.active, true), ne(employees.status, 'inactive')),
    );
    const ok = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
    // The same message whether the email or the password was wrong, so nobody can probe for accounts.
    if (!row || !ok) throw new UnauthorizedException('Wrong email or password');
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.id));
    const user = toCurrentUser(row);
    return { token: await this.jwt.signAsync({ sub: user.id, role: user.role }), user };
  }

  async changePassword(userId: string, { currentPassword, newPassword }: ChangePasswordInput): Promise<CurrentUser> {
    const [row] = await this.selectUser().where(eq(users.id, userId));
    if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) throw new UnauthorizedException('Your current password is wrong');
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
      .where(eq(users.id, userId));
    return { ...toCurrentUser(row), mustChangePassword: false };
  }
}

function toCurrentUser({ passwordHash: _hash, ...row }: Omit<CurrentUser, 'role'> & { passwordHash: string; role: string }): CurrentUser {
  return { ...row, role: row.role as Role };
}
