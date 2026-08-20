import { describe, expect, it } from 'vitest';

import { cooperativeNameSchema, cooperativeSummarySchema, slugify, tenantSlugSchema } from './tenant.js';

describe('tenantSlugSchema', () => {
  it('accepts a well-formed slug', () => {
    expect(tenantSlugSchema.safeParse('umurenge-savings-group').success).toBe(true);
  });

  it('rejects a reserved slug', () => {
    const result = tenantSlugSchema.safeParse('admin');
    expect(result.success).toBe(false);
  });

  it('rejects uppercase letters', () => {
    expect(tenantSlugSchema.safeParse('MyCoop').success).toBe(false);
  });

  it('rejects spaces and underscores', () => {
    expect(tenantSlugSchema.safeParse('my coop').success).toBe(false);
    expect(tenantSlugSchema.safeParse('my_coop').success).toBe(false);
  });

  it('rejects leading, trailing, or doubled hyphens', () => {
    expect(tenantSlugSchema.safeParse('-coop').success).toBe(false);
    expect(tenantSlugSchema.safeParse('coop-').success).toBe(false);
    expect(tenantSlugSchema.safeParse('my--coop').success).toBe(false);
  });

  it('rejects a single character', () => {
    expect(tenantSlugSchema.safeParse('a').success).toBe(false);
  });

  it('rejects more than 63 characters', () => {
    expect(tenantSlugSchema.safeParse('a'.repeat(64)).success).toBe(false);
  });
});

describe('cooperativeNameSchema', () => {
  it('accepts a normal name', () => {
    expect(cooperativeNameSchema.safeParse('Umurenge Savings Group').success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(cooperativeNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects more than 255 characters', () => {
    expect(cooperativeNameSchema.safeParse('a'.repeat(256)).success).toBe(false);
  });
});

describe('cooperativeSummarySchema', () => {
  it('accepts id/name/slug without createdAt', () => {
    const result = cooperativeSummarySchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Coop',
      slug: 'coop',
    });
    expect(result.success).toBe(true);
  });
});

describe('slugify', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(slugify('Umurenge Savings Group')).toBe('umurenge-savings-group');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Solidarité')).toBe('cafe-solidarite');
  });

  it('collapses runs of punctuation/whitespace into a single hyphen', () => {
    expect(slugify('  Multiple   Spaces, Punctuation!! ')).toBe('multiple-spaces-punctuation');
  });

  it('falls back to a generic slug when nothing alphanumeric survives', () => {
    expect(slugify('!!!')).toBe('cooperative');
  });

  it('falls back to a generic slug when the result would be too short', () => {
    expect(slugify('A')).toBe('cooperative');
  });

  it('truncates a very long name to stay well under the 63-character cap', () => {
    const result = slugify('x'.repeat(80));
    expect(result.length).toBeLessThanOrEqual(55);
    expect(tenantSlugSchema.safeParse(result).success).toBe(true);
  });

  it('produces a tenantSlugSchema-valid value for an ordinary name', () => {
    // Not a universal guarantee — a name that slugifies to a reserved word
    // (e.g. "Admin" -> "admin") fails tenantSlugSchema on its own; skipping
    // to a disambiguated candidate is the caller's job (see
    // AuthService.insertTenantAndMembership/previewCooperativeSlug).
    expect(tenantSlugSchema.safeParse(slugify('Umurenge Savings Group')).success).toBe(true);
  });
});
