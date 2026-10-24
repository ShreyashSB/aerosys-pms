import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * A "pipe" runs on a request value before it reaches the controller method.
 * This one checks the request body against a Zod schema and returns the
 * parsed, typed value, or answers 400 with the list of problems.
 *
 *   @Post() create(@Body(new ZodValidationPipe(CreateClientSchema)) body: CreateClientDto)
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}
