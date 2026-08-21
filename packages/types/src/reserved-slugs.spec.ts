import { describe, expect, it } from 'vitest';

import { isReservedSlug, RESERVED_SLUGS } from './reserved-slugs.js';

describe('isReservedSlug', () => {
  it('rejects every slug on the reserved list', () => {
    for (const slug of RESERVED_SLUGS) {
      expect(isReservedSlug(slug)).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isReservedSlug('ADMIN')).toBe(true);
    expect(isReservedSlug('Admin')).toBe(true);
  });

  it('allows a slug that is not reserved', () => {
    expect(isReservedSlug('umurenge-savings-group')).toBe(false);
  });
});
