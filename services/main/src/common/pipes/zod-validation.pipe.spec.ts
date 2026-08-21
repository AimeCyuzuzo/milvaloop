import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({ email: z.email(), age: z.number().min(18) });
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value when it passes validation', () => {
    const input = { email: 'a@example.com', age: 30 };
    expect(pipe.transform(input)).toEqual(input);
  });

  it('throws BadRequestException on invalid input', () => {
    expect(() => pipe.transform({ email: 'not-an-email', age: 30 })).toThrow(
      BadRequestException,
    );
  });

  it('reports every failing field, not just the first', () => {
    try {
      pipe.transform({ email: 'not-an-email', age: 5 });
      throw new Error('expected transform to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        issues: { path: unknown[] }[];
      };
      const paths = response.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('email');
      expect(paths).toContain('age');
    }
  });

  it('strips unknown properties from the parsed result if the schema does', () => {
    const input = { email: 'a@example.com', age: 30, extra: 'unexpected' };
    expect(pipe.transform(input)).toEqual({ email: 'a@example.com', age: 30 });
  });
});
