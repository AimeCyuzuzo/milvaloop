import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import { ApiError } from '../api/api-fetch';

interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

// Maps a 400 validation response's field-level issues (see
// ZodValidationPipe on the backend) onto the matching form fields, so a
// server-side rejection shows up the same inline way a client-side one
// does. Returns a generic message to show in a page-level Alert for
// anything not tied to one field (wrong password, a 409 conflict, a link
// that's expired) — never a raw error object.
export function applyServerError<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  error: unknown,
): string | null {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  const body = error.body as { message?: string; issues?: ValidationIssue[] } | null;

  if (body?.issues?.length) {
    let appliedToField = false;
    for (const issue of body.issues) {
      const path = issue.path.join('.');
      if (path) {
        form.setError(path as Path<TFieldValues>, { message: issue.message });
        appliedToField = true;
      }
    }
    if (appliedToField) {
      return null;
    }
  }

  return body?.message ?? 'Something went wrong. Please try again.';
}
