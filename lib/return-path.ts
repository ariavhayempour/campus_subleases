const NO_RETURN_PREFIXES = ['/sign-in', '/sign-up', '/onboarding', '/api'];

// Only the path is kept, so a return URL can never send the user off this site.
export function safeReturnPath(value: string | string[] | undefined | null): string | null {
  if (typeof value !== 'string' || value === '') return null;
  if (/^[/\\]{2}/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, 'http://return.invalid');
  } catch {
    return null;
  }
  const { pathname } = url;
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\'))
    return null;
  if (pathname === '/') return null;
  if (
    NO_RETURN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return null;
  }
  return `${pathname}${url.search}${url.hash}`;
}

export function onboardingUrl(returnPath: string | null): string {
  return returnPath ? `/onboarding?next=${encodeURIComponent(returnPath)}` : '/onboarding';
}
