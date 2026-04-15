// middleware.ts — protege rutas del dashboard

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas públicas — accesibles sin login
  const publicPaths = ['/login', '/register', '/auth/callback']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // Rutas protegidas — requieren login
  const isProtected =
    pathname === '/' ||
    pathname.startsWith('/hotels') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/site-audit') ||
    pathname.startsWith('/result')

  // Si no está autenticado y trata de acceder a ruta protegida → login
  if (!user && !isPublic && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si ya está autenticado y va a login/register → redirigir a hotels
  if (user && isPublic) {
    return NextResponse.redirect(new URL('/hotels', request.url))
  }

  return supabaseResponse
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
