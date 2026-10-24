import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Expense } from '../db/schema.js';
import {
  ExpenseInputSchema,
  ExpenseQuerySchema,
  ReviewInputSchema,
  type ExpenseInput,
  type ExpenseQuery,
  type ReviewInput,
} from './expenses.dto.js';
import { ExpensesService } from './expenses.service.js';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  /** GET /api/expenses?projectId=…&status=pending (both optional) */
  @Get()
  list(@Query(new ZodValidationPipe(ExpenseQuerySchema)) q: ExpenseQuery): Promise<Expense[]> {
    return this.expenses.list(q);
  }

  /** POST /api/expenses */
  @Post()
  create(@Body(new ZodValidationPipe(ExpenseInputSchema)) body: ExpenseInput): Promise<Expense> {
    return this.expenses.create(body);
  }

  /** PATCH /api/expenses/:id/approve */
  @Patch(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ReviewInputSchema)) body: ReviewInput): Promise<Expense> {
    return this.expenses.approve(id, body);
  }

  /** PATCH /api/expenses/:id/reject (a note is required) */
  @Patch(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ReviewInputSchema)) body: ReviewInput): Promise<Expense> {
    return this.expenses.reject(id, body);
  }

  /** DELETE /api/expenses/:id → withdraw a pending expense (204) */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.expenses.remove(id);
  }
}
