// lib/analyzers/links.ts
// Detecta broken links (4xx/5xx) y redirect chains (3+ saltos) en una página HTML.

import * as cheerio from 'cheerio'

export interface LinkIssue {
  type:        'broken_link' | 'redirect_chain' | 'redirect_loop'
  severity:    'critical' | 'high' | 'low'
  url:         string
  sourceUrl:   string
  description: string
  statusCode?: number
  hops?:       number
}

export interface LinksResult {
  checked:  number
  issues:   LinkIssue[]
}

const FETCH_TIMEOUT = 8_000
const MAX_LINKS     = 40   // límite por página para no exceder Vercel

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkLink(
  href: string,
  sourceUrl: string,
): Promise<LinkIssue | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(href, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
    })

    const status = response.status

    // 4xx / 5xx → broken link
    if (status >= 400) {
      return {
        type:        'broken_link',
        severity:    status >= 500 ? 'high' : 'critical',
        url:         href,
        sourceUrl,
        description: `El enlace devuelve HTTP ${status}`,
        statusCode:  status,
      }
    }

    // 3xx → seguir cadena de redirecciones (hasta 5 saltos)
    if (status >= 300 && status < 400) {
      const chain  = await followRedirects(href, 0)
      if (chain.type === 'loop') {
        return {
          type:        'redirect_loop',
          severity:    'critical',
          url:         href,
          sourceUrl,
          description: `Loop de redirecciones detectado`,
          hops:        chain.hops,
        }
      }
      if (chain.hops >= 3) {
        return {
          type:        'redirect_chain',
          severity:    'high',
          url:         href,
          sourceUrl,
          description: `Cadena de ${chain.hops} redirecciones (recomendado: enlazar directo al destino)`,
          hops:        chain.hops,
        }
      }
    }

    return null
  } catch {
    return null  // timeout o error de red — no reportar como broken
  } finally {
    clearTimeout(timer)
  }
}

interface RedirectResult { type: 'ok' | 'loop'; hops: number }

async function followRedirects(url: string, depth: number): Promise<RedirectResult> {
  if (depth > 8) return { type: 'loop', hops: depth }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return { type: 'ok', hops: depth }
      const next = location.startsWith('http') ? location : new URL(location, url).href
      if (next === url) return { type: 'loop', hops: depth }
      return followRedirects(next, depth + 1)
    }

    return { type: 'ok', hops: depth }
  } catch {
    return { type: 'ok', hops: depth }
  } finally {
    clearTimeout(timer)
  }
}

function isInternalOrSameDomain(href: string, baseUrl: string): boolean {
  try {
    const base   = new URL(baseUrl)
    const target = new URL(href, baseUrl)
    return target.hostname === base.hostname
  } catch {
    return false
  }
}

function normalizeHref(href: string, baseUrl: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null
  }
  try {
    return new URL(href, baseUrl).href
  } catch {
    return null
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function analyzeLinks(html: string, pageUrl: string): Promise<LinksResult> {
  const $ = cheerio.load(html)

  // Extraer todos los <a href> de la página
  const hrefs: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const normalized = normalizeHref(href, pageUrl)
    if (!normalized) return
    // Solo links internos (externos tardan más y no son responsabilidad del hotel)
    if (isInternalOrSameDomain(normalized, pageUrl)) {
      hrefs.push(normalized)
    }
  })

  // Deduplicar y limitar
  const unique = Array.from(new Set(hrefs)).slice(0, MAX_LINKS)

  // Verificar en paralelo (lotes de 5 para no saturar)
  const issues: LinkIssue[] = []
  const BATCH = 5
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch   = unique.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(href => checkLink(href, pageUrl)))
    results.forEach(r => { if (r) issues.push(r) })
  }

  return { checked: unique.length, issues }
}
