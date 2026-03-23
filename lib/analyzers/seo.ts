// lib/analyzers/seo.ts
// Analiza el HTML de una URL y evalúa todos los elementos SEO on-page.
// Spec: spec/features/SEO_MODULE.md

import * as cheerio from 'cheerio'
import { calculateModuleScore } from '../scoring'
import type {
  Check,
  CheckStatus,
  Issue,
  SeoResult,
} from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCheck(
  id: string,
  label: string,
  passed: boolean,
  severity: Check['severity'],
  value?: string,
  warnCondition?: boolean,
): Check {
  let status: CheckStatus = 'pass'
  if (!passed) status = severity === 'warning' || warnCondition ? 'warn' : 'fail'
  return { id, label, status, severity, value }
}

// ─── Análisis principal ───────────────────────────────────────────────────────

export function analyzeSeo(html: string, url: string): SeoResult {
  const $ = cheerio.load(html)
  const checks: Check[] = []
  const issues: Issue[]  = []

  // ── Title ──────────────────────────────────────────────────────────────────
  const title       = $('title').first().text().trim() || null
  const titleLength = title?.length ?? 0

  const titleExists = !!title
  const titleLengthOk = titleLength >= 30 && titleLength <= 60

  checks.push({
    id: 'seo-title-exists',
    label: 'Title tag existe',
    status: titleExists ? 'pass' : 'fail',
    severity: 'critical',
    value: title ?? undefined,
  })

  if (titleExists) {
    checks.push({
      id: 'seo-title-length',
      label: 'Title length (30–60 chars)',
      status: titleLengthOk ? 'pass' : 'warn',
      severity: 'warning',
      value: `${titleLength} chars`,
    })
  }

  if (!titleExists) {
    issues.push({
      id: 'seo-title-exists',
      category: 'seo',
      severity: 'critical',
      title: 'Title tag ausente',
      description: 'No se encontró ningún <title> en el HTML.',
      how_to_fix: 'Agregar <title>Tu título aquí</title> dentro del <head>.',
      docs_url: 'https://developers.google.com/search/docs/appearance/title-link',
    })
  } else if (!titleLengthOk) {
    issues.push({
      id: 'seo-title-length',
      category: 'seo',
      severity: 'warning',
      title: titleLength < 30 ? 'Title demasiado corto' : 'Title demasiado largo',
      description: `El title tiene ${titleLength} caracteres. Lo ideal: 30–60.`,
      how_to_fix: 'Ajustar el título a entre 30 y 60 caracteres para evitar truncamiento en SERPs.',
      value: title ?? undefined,
    })
  }

  // ── Meta description ────────────────────────────────────────────────────────
  const description = $('meta[name="description"]').attr('content')?.trim() ?? null
  const descLength  = description?.length ?? 0

  const descExists   = !!description
  const descLengthOk = descLength >= 120 && descLength <= 160

  checks.push({
    id: 'seo-desc-exists',
    label: 'Meta description existe',
    status: descExists ? 'pass' : 'fail',
    severity: 'critical',
    value: description ?? undefined,
  })

  if (descExists) {
    checks.push({
      id: 'seo-desc-length',
      label: 'Description length (120–160 chars)',
      status: descLengthOk ? 'pass' : 'warn',
      severity: 'warning',
      value: `${descLength} chars`,
    })
  }

  if (!descExists) {
    issues.push({
      id: 'seo-desc-exists',
      category: 'seo',
      severity: 'critical',
      title: 'Meta description ausente',
      description: 'No se encontró <meta name="description"> en el HTML.',
      how_to_fix: 'Agregar <meta name="description" content="Tu descripción"> en el <head>.',
    })
  } else if (!descLengthOk) {
    issues.push({
      id: 'seo-desc-length',
      category: 'seo',
      severity: 'warning',
      title: descLength < 120 ? 'Meta description muy corta' : 'Meta description muy larga',
      description: `La descripción tiene ${descLength} caracteres. Ideal: 120–160.`,
      how_to_fix: 'Ajustar a 120–160 chars para evitar truncamiento en Google.',
      value: description ?? undefined,
    })
  }

  // ── Headings ───────────────────────────────────────────────────────────────
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean)
  const h2s = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean)

  const h1Exists = h1s.length > 0
  const h1Unique = h1s.length === 1

  checks.push({
    id: 'seo-h1-exists',
    label: 'H1 presente',
    status: h1Exists ? 'pass' : 'fail',
    severity: 'critical',
    value: h1Exists ? h1s[0] : undefined,
  })

  if (h1Exists) {
    checks.push({
      id: 'seo-h1-unique',
      label: 'H1 único',
      status: h1Unique ? 'pass' : 'warn',
      severity: 'warning',
      value: `${h1s.length} H1 encontrados`,
    })
  }

  checks.push({
    id: 'seo-h2-exists',
    label: 'H2 presente',
    status: h2s.length > 0 ? 'pass' : 'fail',
    severity: 'info',
    value: h2s.length > 0 ? `${h2s.length} H2` : undefined,
  })

  if (!h1Exists) {
    issues.push({
      id: 'seo-h1-exists',
      category: 'seo',
      severity: 'critical',
      title: 'H1 ausente',
      description: 'No se encontró ningún elemento <h1> en la página.',
      how_to_fix: 'Agregar un <h1> con la keyword principal de la página.',
    })
  } else if (!h1Unique) {
    issues.push({
      id: 'seo-h1-unique',
      category: 'seo',
      severity: 'warning',
      title: 'Múltiples H1 detectados',
      description: `Se encontraron ${h1s.length} elementos <h1>. Google prefiere uno solo.`,
      how_to_fix: 'Conservar un único <h1> y usar <h2>–<h6> para subtítulos.',
      value: `${h1s.length} H1`,
    })
  }

  // ── Canonical ──────────────────────────────────────────────────────────────
  const canonicalHref = $('link[rel="canonical"]').attr('href') ?? null
  const canonicalExists = !!canonicalHref
  let canonicalIsSelf = false

  if (canonicalExists && canonicalHref) {
    try {
      const canonicalNorm = new URL(canonicalHref).href.replace(/\/$/, '')
      const urlNorm       = new URL(url).href.replace(/\/$/, '')
      canonicalIsSelf     = canonicalNorm === urlNorm
    } catch {
      canonicalIsSelf = false
    }
  }

  checks.push({
    id: 'seo-canonical-exists',
    label: 'Canonical tag presente',
    status: canonicalExists ? 'pass' : 'fail',
    severity: 'info',
    value: canonicalHref ?? undefined,
  })

  if (canonicalExists && !canonicalIsSelf) {
    checks.push({
      id: 'seo-canonical-self',
      label: 'Canonical apunta a sí mismo',
      status: 'warn',
      severity: 'warning',
      value: canonicalHref ?? undefined,
    })
    issues.push({
      id: 'seo-canonical-self',
      category: 'seo',
      severity: 'warning',
      title: 'Canonical no coincide con la URL',
      description: `El canonical apunta a ${canonicalHref} pero se analizó ${url}.`,
      how_to_fix: 'Verificar que el canonical sea la URL canónica correcta de la página.',
      value: canonicalHref ?? undefined,
    })
  }

  // ── Open Graph ─────────────────────────────────────────────────────────────
  const ogTitle = $('meta[property="og:title"]').attr('content') ?? null
  const ogDesc  = $('meta[property="og:description"]').attr('content') ?? null
  const ogImage = $('meta[property="og:image"]').attr('content') ?? null
  const ogUrl   = $('meta[property="og:url"]').attr('content') ?? null
  const ogType  = $('meta[property="og:type"]').attr('content') ?? null

  const ogTags: Array<{ id: string; label: string; value: string | null }> = [
    { id: 'seo-og-title',       label: 'OG title presente',       value: ogTitle },
    { id: 'seo-og-description', label: 'OG description presente', value: ogDesc  },
    { id: 'seo-og-image',       label: 'OG image presente',       value: ogImage },
  ]

  for (const tag of ogTags) {
    checks.push({
      id: tag.id,
      label: tag.label,
      status: tag.value ? 'pass' : 'warn',
      severity: 'warning',
      value: tag.value ?? undefined,
    })
    if (!tag.value) {
      issues.push({
        id: tag.id,
        category: 'seo',
        severity: 'warning',
        title: `${tag.label.replace(' presente', '')} ausente`,
        description: `Falta <meta property="${tag.id.replace('seo-og-', 'og:').replace('-', ':')}"> en el HTML.`,
        how_to_fix: 'Agregar el tag Open Graph correspondiente en el <head> para mejorar el aspecto al compartir en redes sociales.',
        docs_url: 'https://ogp.me/',
      })
    }
  }

  // ── Schema.org ─────────────────────────────────────────────────────────────
  const schemaScripts = $('script[type="application/ld+json"]')
  const schemaItems = schemaScripts
    .map((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() ?? '')
        return {
          type: parsed['@type'] ?? 'Unknown',
          raw: parsed,
        }
      } catch {
        return null
      }
    })
    .get()
    .filter(Boolean) as Array<{ type: string; raw: Record<string, unknown> }>

  const schemaFound = schemaItems.length > 0

  checks.push({
    id: 'seo-schema-exists',
    label: 'Schema.org presente',
    status: schemaFound ? 'pass' : 'fail',
    severity: 'info',
    value: schemaFound ? schemaItems.map(s => s.type).join(', ') : undefined,
  })

  // ── Robots ─────────────────────────────────────────────────────────────────
  const robotsContent = $('meta[name="robots"]').attr('content') ?? ''
  const isNoIndex = robotsContent.toLowerCase().includes('noindex')

  checks.push({
    id: 'seo-robots-noindex',
    label: 'No bloqueado por robots',
    status: isNoIndex ? 'fail' : 'pass',
    severity: 'critical',
    value: isNoIndex ? robotsContent : undefined,
  })

  if (isNoIndex) {
    issues.push({
      id: 'seo-robots-noindex',
      category: 'seo',
      severity: 'critical',
      title: 'Página marcada como noindex',
      description: `<meta name="robots" content="${robotsContent}"> detectado.`,
      how_to_fix: 'Eliminar el tag noindex si querés que Google indexe esta página.',
      value: robotsContent,
    })
  }

  // ── Score ──────────────────────────────────────────────────────────────────
  const score = calculateModuleScore(checks)

  return {
    score,
    checks,
    meta: { title, titleLength, description, descriptionLength: descLength },
    headings: { h1s, h2s },
    openGraph: { title: ogTitle, description: ogDesc, image: ogImage, url: ogUrl, type: ogType },
    canonical: { href: canonicalHref, isSelf: canonicalIsSelf },
    schema: { found: schemaFound, items: schemaItems },
    robotsNoindex: isNoIndex,
  }
}

export function getSeoIssues(result: SeoResult): Issue[] {
  // Re-derive issues from checks for the consolidated issues list
  return result.checks
    .filter(c => c.status !== 'pass')
    .map(c => ({
      id: c.id,
      category: 'seo' as const,
      severity: c.status === 'fail' ? c.severity : 'warning' as const,
      title: c.label,
      description: c.value ?? '',
      how_to_fix: '',
    }))
}
