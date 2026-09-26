import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NotFound, parseInput, ServiceError, ValidationError } from '@/server/services/errors';

describe('service errors', () => {
  it('are ServiceErrors with a stable code', () => {
    const error = new NotFound('Listing not found');
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe('NotFound');
    expect(error.message).toBe('Listing not found');
  });

  it('parseInput returns parsed data', () => {
    const schema = z.object({ name: z.string().trim().min(1) });
    expect(parseInput(schema, { name: '  Ada ' })).toEqual({ name: 'Ada' });
  });

  it('parseInput throws ValidationError with field errors', () => {
    const schema = z.object({ name: z.string().min(1, 'Required') });
    try {
      parseInput(schema, { name: '' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors).toEqual({ name: ['Required'] });
    }
  });
});
