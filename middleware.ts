// middleware.ts — auth desactivado temporalmente

import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/hotels/:path*',
    '/reports/:path*',
    '/reports',
    '/settings/:path*',
    '/settings',
    '/projects/:path*',
    '/projects',
    '/site-audit/:path*',
    '/result/:path*',
    '/login',
    '/register',
  ],
}
