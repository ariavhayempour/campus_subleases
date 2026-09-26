import { z } from 'zod';

export type ServiceErrorCode =
  'NotFound' | 'Forbidden' | 'ValidationError' | 'ListingCapReached' | 'RateLimited' | 'Conflict';

export type FieldErrors = Record<string, string[]>;

export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = code;
  }
}

export class NotFound extends ServiceError {
  constructor(message = 'Not found') {
    super('NotFound', message);
  }
}

export class Forbidden extends ServiceError {
  constructor(message = 'Not allowed') {
    super('Forbidden', message);
  }
}

export class ValidationError extends ServiceError {
  constructor(
    readonly fieldErrors: FieldErrors,
    message = 'Check the highlighted fields',
  ) {
    super('ValidationError', message);
  }
}

export class ListingCapReached extends ServiceError {
  constructor(message = 'You already have the maximum number of active listings') {
    super('ListingCapReached', message);
  }
}

export class RateLimited extends ServiceError {
  constructor(message = 'Too many requests — try again later') {
    super('RateLimited', message);
  }
}

export class Conflict extends ServiceError {
  constructor(message = 'This changed while you were working — reload and try again') {
    super('Conflict', message);
  }
}

// Wraps schema.safeParse to raise the shared ValidationError shape services and forms expect.
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const flattened = z.flattenError(result.error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const fieldErrors: FieldErrors = {};
  for (const [field, messages] of Object.entries(flattened)) {
    if (messages?.length) fieldErrors[field] = messages;
  }
  throw new ValidationError(fieldErrors);
}
