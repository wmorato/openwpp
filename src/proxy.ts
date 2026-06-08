import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/_next/'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = publicPaths.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get('token')?.value;

  if (!token && !pathname.startsWith('/api/')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
