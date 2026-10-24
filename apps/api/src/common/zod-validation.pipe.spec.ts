import { BadRequestException } from '@nestjs/common';
import { CreateClientSchema } from '../clients/clients.dto.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(CreateClientSchema);

  it('returns the parsed body, with whitespace trimmed', () => {
    expect(pipe.transform({ name: '  Tata Projects ' })).toEqual({ name: 'Tata Projects' });
  });

  it('rejects an invalid body with a 400 listing each field', () => {
    try {
      pipe.transform({ name: 'A' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toMatchObject({ errors: [{ field: 'name' }] });
    }
  });
});
