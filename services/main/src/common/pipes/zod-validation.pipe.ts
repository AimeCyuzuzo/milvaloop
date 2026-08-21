import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

// Validates a request body/query/param against a Zod schema at the
// controller boundary (see CODE_QUALITY.md's "validate at every trust
// boundary" rule). Used per-parameter: `@Body(new ZodValidationPipe(schema))`.
export class ZodValidationPipe<
  TSchema extends ZodType,
> implements PipeTransform<unknown, z.infer<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
