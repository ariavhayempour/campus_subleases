import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { PATHNAME_HEADER } from '@/lib/request-headers';

export default clerkMiddleware(
  (_auth, req) => {
    const headers = new Headers(req.headers);
    headers.set(PATHNAME_HEADER, req.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  },
  { signInUrl: '/sign-in', signUpUrl: '/sign-up' },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
