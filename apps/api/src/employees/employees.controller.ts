import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ReadScopeService } from '../auth/read-scope.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Employee } from '../db/schema.js';
import { EmployeeInputSchema, type EmployeeInput } from './employees.dto.js';
import { EmployeesService } from './employees.service.js';

@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly scopes: ReadScopeService,
  ) {}

  /** GET /api/employees */
  @Get()
  async list(@User() user: CurrentUser): Promise<Employee[]> {
    const scope = await this.scopes.for(user);
    return (await this.employees.list()).map((e) => withoutRate(e, scope.rates));
  }

  /** GET /api/employees/:id — ParseUUIDPipe answers 400 for a malformed id before we hit the database. */
  @Get(':id')
  async get(@User() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string): Promise<Employee> {
    const scope = await this.scopes.for(user);
    return withoutRate(await this.employees.get(id), scope.rates);
  }

  /** POST /api/employees */
  @Allow('employee.manage')
  @Post()
  create(@Body(new ZodValidationPipe(EmployeeInputSchema)) body: EmployeeInput): Promise<Employee> {
    return this.employees.create(body);
  }

  /** PUT /api/employees/:id */
  @Allow('employee.manage')
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EmployeeInputSchema)) body: EmployeeInput,
  ): Promise<Employee> {
    return this.employees.update(id, body);
  }
}

/** The daily cost rate is blanked for roles without `rates.view`. */
function withoutRate(e: Employee, rates: boolean): Employee {
  return rates ? e : { ...e, dailyCost: 0 };
}
