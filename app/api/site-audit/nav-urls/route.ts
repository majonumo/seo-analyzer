// app/api/site-audit/nav-urls/route.ts
// GET /api/site-audit/nav-urls?url=...
// Extrae links del menú de navegación del sitio (nav, header).
// Se usa para determinar qué páginas son "principales" y ejecutar Lighthouse solo en ellas.

import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

const TIMEOUT_MS = 8_000
const MAX_NAV    = 10 // máximo de páginas de nav para Lighthouse

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') ?? ''
  if (!raw) return NextResponse.json({ urls: [], count: 0 })

  let baseUrl: string
  try {
    baseUrl = raw.startsWith('http') ? raw : `https://${raw}`
    new URL(baseUrl)
  } catch {
    return NextResponse.json({ urls: [], count: 0 })
  }

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(baseUrl, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzerBot/1.0)' },
      redirect: 'follow',
    })

    if (!res.ok) return NextResponse.json({ urls: [], count: 0 })

    const html   = await res.text()
    const $      = cheerio.load(html)
    const origin = new URL(baseUrl).origin
    const seen   = new Set<string>()
    const urls:  string[] = []

    const collectLinks = (selector: string) => {
      $(selector).each((_, el) => {
        const href = $(el).attr('href')
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
        try {
          const u     = new URL(href, baseUrl)
          const clean = u.origin + u.pathname.replace(/\/$/, '') || '/'
          if (u.origin !== origin) return
          if (seen.has(clean)) return
          seen.add(clean)
          urls.push(u.origin + u.pathname)
        } catch { /* ignorar hrefs inválidos */ }
      })
    }

    // 1. Prioridad: links dentro del <header> (menú principal)
    collectLinks('header nav a, header [role="navigation"] a, header a[href]')

    // 2. Si el header no tiene suficientes links, usar solo el PRIMER <nav>
    //    (casi siempre es el menú principal, no footer ni sidebar)
    if (urls.length < 2) {
      seen.clear()
      urls.length = 0
      const firstNav = $('nav').first()
      firstNav.find('a').each((_, el) => {
        const href = $(el).attr('href')
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
        try {
          const u     = new URL(href, baseUrl)
          const clean = u.origin + u.pathname.replace(/\/$/, '') || '/'
          if (u.origin !== origin) return
          if (seen.has(clean)) return
          seen.add(clean)
          urls.push(u.origin + u.pathname)
        } catch { /* ignorar */ }
      })
    }

    // Incluir la home si no está
    const home = origin + '/'
    if (!seen.has(origin) && !seen.has(home)) {
      urls.unshift(baseUrl)
    }

    const result = urls.slice(0, MAX_NAV)
    return NextResponse.json({ urls: result, count: result.length })
  } catch {
    return NextResponse.json({ urls: [], count: 0 })
  } finally {
    clearTimeout(timer)
  }
}
