import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { Allow } from '../auth/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Employee } from '../db/schema.js';
import { EmployeeInputSchema, type EmployeeInput } from './employees.dto.js';
import { EmployeesService } from './employees.service.js';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  /** GET /api/employees */
  @Get()
  list(): Promise<Employee[]> {
    return this.employees.list();
  }

  /** GET /api/employees/:id — ParseUUIDPipe answers 400 for a malformed id before we hit the database. */
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Employee> {
    return this.employees.get(id);
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
