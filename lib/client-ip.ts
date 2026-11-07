// Vercel sets both headers itself, so a client cannot spoof them in production.
export function clientIp(headers: Pick<Headers, 'get'>): string | undefined {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
}
