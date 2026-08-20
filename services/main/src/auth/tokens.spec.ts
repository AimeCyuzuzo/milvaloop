import {
  generateOpaqueToken,
  hashToken,
  parseTtlMs,
  parseTtlSeconds,
} from './tokens';

describe('generateOpaqueToken', () => {
  it('generates a 64-character hex string', () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never generates the same token twice', () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => generateOpaqueToken()),
    );
    expect(tokens.size).toBe(1000);
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('never returns the raw input', () => {
    expect(hashToken('abc')).not.toBe('abc');
  });
});

describe('parseTtlMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
  ])('parses %s as %d ms', (input, expected) => {
    expect(parseTtlMs(input)).toBe(expected);
  });

  it.each(['15', '15x', 'm15', '', '15 m'])(
    'rejects an invalid format: %s',
    (input) => {
      expect(() => parseTtlMs(input)).toThrow();
    },
  );
});

describe('parseTtlSeconds', () => {
  it('converts to whole seconds', () => {
    expect(parseTtlSeconds('15m')).toBe(900);
    expect(parseTtlSeconds('30d')).toBe(2_592_000);
  });
});
