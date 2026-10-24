/**
 * Postgres reports constraint problems with a five-character code. We turn the
 * two we expect into clear HTTP answers instead of a generic 500.
 * Codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

function code(err: unknown): string | undefined {
  // postgres-js puts the code on the error; Drizzle may wrap it in `cause`.
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export const isUniqueViolation = (err: unknown) => code(err) === UNIQUE_VIOLATION;
export const isForeignKeyViolation = (err: unknown) => code(err) === FOREIGN_KEY_VIOLATION;
