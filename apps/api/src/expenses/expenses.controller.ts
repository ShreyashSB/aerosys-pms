import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Expense } from '../db/schema.js';
import { ExpenseInputSchema, ExpenseQuerySchema, type ExpenseInput, type ExpenseQuery } from './expenses.dto.js';
import { ExpensesService } from './expenses.service.js';

/**
 * Accounts records expenses on behalf of whoever spent the money. A recorded
 * expense counts towards project cost straight away, so there is no
 * approve/reject step.
 */
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  /** GET /api/expenses?projectId=… (optional) */
  @Get()
  list(@Query(new ZodValidationPipe(ExpenseQuerySchema)) q: ExpenseQuery): Promise<Expense[]> {
    return this.expenses.list(q);
  }

  /** POST /api/expenses */
  @Allow('expense.create')
  @Post()
  create(@User() user: CurrentUser, @Body(new ZodValidationPipe(ExpenseInputSchema)) body: ExpenseInput): Promise<Expense> {
    return this.expenses.create(body, user);
  }

  /** DELETE /api/expenses/:id → remove a wrong entry (204) */
  @Allow('expense.create')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.expenses.remove(id);
  }
}
