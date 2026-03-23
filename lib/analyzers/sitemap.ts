// lib/analyzers/sitemap.ts
// Detecta, descarga y valida el sitemap del sitio analizado.
// Estrategia: robots.txt → /sitemap.xml → /sitemap_index.xml → /sitemap/

import type { SitemapResult, SitemapUrl, Check } from '../types'
import { calculateModuleScore } from '../scoring'

const TIMEOUT_MS   = 5_000
const MAX_URLS     = 50

// ─── Helpers XML ──────────────────────────────────────────────────────────────

function extractTagValues(xml: string, tag: string): string[] {
  const re      = new RegExp(`<${tag}[^>]*>\\s*([^<]+)\\s*</${tag}>`, 'gi')
  const results: string[] = []
  let   m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim())
  }
  return results
}

function extractBlocks(xml: string, tag: string): string[] {
  const re      = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, 'gi')
  const results: string[] = []
  let   m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0])
  }
  return results
}

function parseUrlBlock(block: string): SitemapUrl {
  const get = (t: string) => extractTagValues(block, t)[0]
  return {
    loc:        get('loc')        ?? '',
    lastmod:    get('lastmod'),
    changefreq: get('changefreq'),
    priority:   get('priority'),
  }
}

// ─── Fetch con timeout ────────────────────────────────────────────────────────

async function safeFetch(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzerBot/1.0)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ─── Detectar URL del sitemap ─────────────────────────────────────────────────

async function detectSitemapUrl(baseUrl: string): Promise<string | null> {
  const origin = new URL(baseUrl).origin

  // 1. Buscar en robots.txt
  const robotsTxt = await safeFetch(`${origin}/robots.txt`)
  if (robotsTxt) {
    const matches = [...robotsTxt.matchAll(/^Sitemap:\s*(.+)$/gim)]
    if (matches.length > 0) return matches[0][1].trim()
  }

  // 2. Rutas comunes — en paralelo para no bloquear
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap/`,
    `${origin}/sitemap/sitemap.xml`,
  ]

  const results = await Promise.all(
    candidates.map(async (url) => {
      const content = await safeFetch(url)
      if (content && (content.includes('<urlset') || content.includes('<sitemapindex'))) {
        return url
      }
      return null
    })
  )

  return results.find(r => r !== null) ?? null
}

// ─── Parsear sitemap ──────────────────────────────────────────────────────────

interface ParsedSitemap {
  isIndex:   boolean
  urls:      SitemapUrl[]
  sitemaps?: string[]
  errors:    string[]
}

function parseSitemap(xml: string): ParsedSitemap {
  const errors: string[] = []

  if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) {
    errors.push('El archivo no parece ser un sitemap XML válido.')
    return { isIndex: false, urls: [], errors }
  }

  // Es un sitemap index
  if (xml.includes('<sitemapindex')) {
    const locs = extractTagValues(xml, 'loc')
    return { isIndex: true, urls: [], sitemaps: locs, errors }
  }

  // Sitemap normal — parsear <url> blocks
  const blocks = extractBlocks(xml, 'url')
  const urls   = blocks.map(parseUrlBlock).filter(u => u.loc.length > 0)

  // Validaciones
  const invalidLocs = urls.filter(u => !u.loc.startsWith('http'))
  if (invalidLocs.length > 0) {
    errors.push(`${invalidLocs.length} URL(s) con formato inválido (no empieza con http).`)
  }

  const withoutLastmod = urls.filter(u => !u.lastmod).length
  const warnings: string[] = []
  if (withoutLastmod === urls.length && urls.length > 0) {
    warnings.push('Ninguna URL tiene <lastmod> definido.')
  }

  return { isIndex: false, urls, errors }
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function buildChecks(result: Omit<SitemapResult, 'checks' | 'score'>): Check[] {
  const checks: Check[] = []

  checks.push({
    id:       'sitemap-found',
    label:    'Sitemap encontrado',
    status:   result.found ? 'pass' : 'fail',
    severity: 'critical',
    value:    result.found ? result.url : 'No encontrado',
  })

  if (!result.found) return checks

  checks.push({
    id:       'sitemap-valid-xml',
    label:    'XML válido',
    status:   result.errors.length === 0 ? 'pass' : 'fail',
    severity: 'critical',
    value:    result.errors.length === 0 ? 'OK' : result.errors.join('; '),
  })

  checks.push({
    id:       'sitemap-has-urls',
    label:    'Contiene URLs',
    status:   result.urlCount > 0 ? 'pass' : 'warn',
    severity: 'warning',
    value:    `${result.urlCount} URL(s)`,
  })

  if (result.urlCount > 0) {
    const urlsWithLastmod = result.urls.filter(u => u.lastmod).length
    const ratio           = urlsWithLastmod / Math.min(result.urls.length, MAX_URLS)
    checks.push({
      id:       'sitemap-lastmod',
      label:    'URLs con <lastmod>',
      status:   ratio >= 0.8 ? 'pass' : ratio > 0 ? 'warn' : 'fail',
      severity: 'warning',
      value:    `${urlsWithLastmod}/${Math.min(result.urls.length, MAX_URLS)} URLs`,
    })

    const urlsWithPriority = result.urls.filter(u => u.priority).length
    checks.push({
      id:       'sitemap-priority',
      label:    'URLs con <priority>',
      status:   urlsWithPriority > 0 ? 'pass' : 'warn',
      severity: 'info',
      value:    `${urlsWithPriority}/${Math.min(result.urls.length, MAX_URLS)} URLs`,
    })
  }

  if (result.warnings.length > 0) {
    checks.push({
      id:       'sitemap-warnings',
      label:    'Advertencias',
      status:   'warn',
      severity: 'warning',
      value:    result.warnings.join('; '),
    })
  }

  return checks
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function analyzeSitemap(pageUrl: string): Promise<SitemapResult> {
  const sitemapUrl = await detectSitemapUrl(pageUrl)

  if (!sitemapUrl) {
    const base: Omit<SitemapResult, 'checks' | 'score'> = {
      found:    false,
      isIndex:  false,
      urlCount: 0,
      urls:     [],
      errors:   [],
      warnings: [],
    }
    const checks = buildChecks(base)
    return { ...base, checks, score: calculateModuleScore(checks) }
  }

  const xml = await safeFetch(sitemapUrl)

  if (!xml) {
    const base: Omit<SitemapResult, 'checks' | 'score'> = {
      found:    true,
      url:      sitemapUrl,
      isIndex:  false,
      urlCount: 0,
      urls:     [],
      errors:   ['No se pudo descargar el sitemap.'],
      warnings: [],
    }
    const checks = buildChecks(base)
    return { ...base, checks, score: calculateModuleScore(checks) }
  }

  const parsed   = parseSitemap(xml)
  const warnings: string[] = []

  // Si es index, intentamos descargar el primer sub-sitemap para contar URLs
  let allUrls: SitemapUrl[] = parsed.urls

  if (parsed.isIndex && parsed.sitemaps && parsed.sitemaps.length > 0) {
    const firstSub = await safeFetch(parsed.sitemaps[0])
    if (firstSub) {
      const sub = parseSitemap(firstSub)
      allUrls   = sub.urls
      if (sub.errors.length > 0) parsed.errors.push(...sub.errors)
    }
    warnings.push(`Es un Sitemap Index con ${parsed.sitemaps.length} sub-sitemaps. Mostrando muestra del primero.`)
  }

  const base: Omit<SitemapResult, 'checks' | 'score'> = {
    found:    true,
    url:      sitemapUrl,
    isIndex:  parsed.isIndex,
    urlCount: parsed.isIndex ? (parsed.sitemaps?.length ?? 0) : allUrls.length,
    urls:     allUrls.slice(0, MAX_URLS),
    sitemaps: parsed.sitemaps,
    errors:   parsed.errors,
    warnings,
  }

  const checks = buildChecks(base)
  return { ...base, checks, score: calculateModuleScore(checks) }
}
