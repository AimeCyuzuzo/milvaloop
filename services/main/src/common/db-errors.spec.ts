import { isForeignKeyViolation, isUniqueViolation } from './db-errors';

describe('isUniqueViolation', () => {
  it('matches a raw Postgres unique-violation error', () => {
    const error = { code: '23505', constraint_name: 'users_email_unique' };
    expect(isUniqueViolation(error, 'users_email_unique')).toBe(true);
  });

  it("matches a unique-violation nested under drizzle-orm's DrizzleQueryError.cause", () => {
    const error = {
      message: 'Failed query',
      cause: { code: '23505', constraint_name: 'users_email_unique' },
    };
    expect(isUniqueViolation(error, 'users_email_unique')).toBe(true);
  });

  it('rejects a different constraint name', () => {
    const error = { code: '23505', constraint_name: 'tenants_slug_unique' };
    expect(isUniqueViolation(error, 'users_email_unique')).toBe(false);
  });

  it('rejects a different SQLSTATE code', () => {
    const error = { code: '23503', constraint_name: 'users_email_unique' };
    expect(isUniqueViolation(error, 'users_email_unique')).toBe(false);
  });

  it('rejects non-error values without throwing', () => {
    expect(isUniqueViolation(null, 'users_email_unique')).toBe(false);
    expect(isUniqueViolation(undefined, 'users_email_unique')).toBe(false);
    expect(isUniqueViolation('a plain string', 'users_email_unique')).toBe(
      false,
    );
    expect(isUniqueViolation(42, 'users_email_unique')).toBe(false);
  });

  it('does not infinitely recurse on a self-referencing cause', () => {
    const error: { code: string; cause?: unknown } = { code: 'other' };
    error.cause = error;
    expect(() => isUniqueViolation(error, 'users_email_unique')).not.toThrow();
  });
});

describe('isForeignKeyViolation', () => {
  it('matches a raw Postgres foreign-key-violation error', () => {
    const error = {
      code: '23503',
      constraint_name:
        'contribution_allocations_share_price_id_share_prices_id_fk',
    };
    expect(
      isForeignKeyViolation(
        error,
        'contribution_allocations_share_price_id_share_prices_id_fk',
      ),
    ).toBe(true);
  });

  it('rejects a unique-violation code', () => {
    const error = {
      code: '23505',
      constraint_name:
        'contribution_allocations_share_price_id_share_prices_id_fk',
    };
    expect(
      isForeignKeyViolation(
        error,
        'contribution_allocations_share_price_id_share_prices_id_fk',
      ),
    ).toBe(false);
  });
});
