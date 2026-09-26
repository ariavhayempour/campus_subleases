import {
  ServiceError,
  ValidationError,
  type FieldErrors,
  type ServiceErrorCode,
} from '@/server/services/errors';

export type ActionError = { code: ServiceErrorCode; message: string; fieldErrors?: FieldErrors };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

// Expected service errors become form-renderable results; anything else propagates to error.tsx and Sentry.
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    const actionError: ActionError = { code: error.code, message: error.message };
    if (error instanceof ValidationError) actionError.fieldErrors = error.fieldErrors;
    return { ok: false, error: actionError };
  }
}
