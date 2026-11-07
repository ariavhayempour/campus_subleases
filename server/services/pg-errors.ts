// Drivers may wrap the Postgres error, so walk the cause chain.
export function hasPgCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
