// app/api/site-audit/page/route.ts
// POST /api/site-audit/page — analiza una sola página (SEO + Performance, sin Lighthouse ni sitemap)

import { NextRequest, NextResponse } from 'next/server'
import type { PageAuditResult, Issue, Severity } from '@/lib/types'
import { fetchPage }          from '@/lib/analyzers'
import { analyzeSeo }         from '@/lib/analyzers/seo'
import { analyzePerformance } from '@/lib/analyzers/performance'
import { calculateGlobalScore } from '@/lib/scoring'

export const maxDuration = 20

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning:  1,
  info:     2,
}

const HOW_TO_FIX: Record<string, string> = {
  'seo-title-exists':        'Agregar <title>Tu título aquí</title> dentro del <head>.',
  'seo-title-length':        'Ajustar el título a entre 30 y 60 caracteres para evitar truncamiento en SERPs.',
  'seo-desc-exists':         'Agregar <meta name="description" content="Tu descripción"> en el <head>.',
  'seo-desc-length':         'Ajustar a 120–160 chars para evitar truncamiento en Google.',
  'seo-h1-exists':           'Agregar un <h1> con la keyword principal de la página.',
  'seo-h1-unique':           'Conservar un único <h1> y usar <h2>–<h6> para subtítulos.',
  'seo-h2-exists':           'Agregar al menos un <h2> para estructurar el contenido.',
  'seo-canonical-exists':    'Agregar <link rel="canonical" href="URL"> en el <head>.',
  'seo-canonical-self':      'Verificar que el canonical sea la URL canónica correcta de la página.',
  'seo-og-title':            'Agregar <meta property="og:title" content="Título"> en el <head>.',
  'seo-og-description':      'Agregar <meta property="og:description" content="Descripción"> en el <head>.',
  'seo-og-image':            'Agregar <meta property="og:image" content="URL imagen"> (1200×630px recomendado).',
  'seo-schema-exists':       'Agregar structured data en formato JSON-LD para habilitar rich results.',
  'seo-robots-noindex':      'Eliminar el tag noindex si querés que Google indexe esta página.',
  'perf-html-size':          'Minimizar HTML, eliminar comentarios, reducir whitespace y contenido inline innecesario.',
  'perf-dom-size':           'Simplificar la estructura HTML, usar lazy loading para secciones fuera del viewport.',
  'perf-blocking-scripts':   'Agregar defer o async al script: <script src="..." defer>.',
  'perf-images-alt':         'Agregar alt descriptivo a cada imagen. Para imágenes decorativas: alt="".',
  'perf-images-dimensions':  'Definir width y height en cada <img> para evitar Cumulative Layout Shift (CLS).',
  'perf-inline-styles':      'Mover los estilos a clases CSS en un archivo externo o en <style>.',
  'perf-deprecated-tags':    'Reemplazar con CSS equivalente. Ej: <center> → margin: 0 auto.',
  'perf-viewport-meta':      'Agregar <meta name="viewport" content="width=device-width, initial-scale=1"> en el <head>.',
  'perf-favicon':            'Agregar <link rel="icon" href="/favicon.ico"> en el <head>.',
}

const DOCS_URLS: Record<string, string> = {
  'seo-title-exists':       'https://developers.google.com/search/docs/appearance/title-link',
  'seo-desc-exists':        'https://developers.google.com/search/docs/appearance/snippet',
  'seo-canonical-self':     'https://developers.google.com/search/docs/crawling-indexing/canonicalization',
  'seo-og-title':           'https://ogp.me/',
  'seo-schema-exists':      'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  'seo-robots-noindex':     'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
  'perf-blocking-scripts':  'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#defer',
  'perf-images-alt':        'https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt',
  'perf-images-dimensions': 'https://web.dev/articles/cls',
  'perf-viewport-meta':     'https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag',
}

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(errorResult('', 'Body inválido.'), { status: 200 })
  }

  const url = (body.url ?? '').trim()
  if (!url) {
    return NextResponse.json(errorResult('', 'URL requerida.'), { status: 200 })
  }

  try {
    const { html, sizeBytes } = await fetchPage(url)
    const [seoResult, perfResult] = await Promise.all([
      analyzeSeo(html, url),
      analyzePerformance(html, sizeBytes, url),
    ])

    const score = calculateGlobalScore(seoResult.score, perfResult.score)

    // Build issues from failed/warned checks (SEO + Perf only)
    const seoIssues: Issue[] = seoResult.checks
      .filter(c => c.status !== 'pass')
      .map(c => ({
        id:          c.id,
        category:    'seo' as const,
        severity:    c.status === 'fail' ? c.severity : ('warning' as const),
        title:       c.label,
        description: c.value ?? `Check ${c.label} falló.`,
        how_to_fix:  HOW_TO_FIX[c.id] ?? 'Revisar la documentación correspondiente.',
        value:       c.value,
        docs_url:    DOCS_URLS[c.id],
      }))

    const perfIssues: Issue[] = perfResult.checks
      .filter(c => c.status !== 'pass')
      .map(c => ({
        id:          c.id,
        category:    'performance' as const,
        severity:    c.status === 'fail' ? c.severity : ('warning' as const),
        title:       c.label,
        description: c.value ?? `Check ${c.label} falló.`,
        how_to_fix:  HOW_TO_FIX[c.id] ?? 'Revisar la documentación correspondiente.',
        value:       c.value,
        docs_url:    DOCS_URLS[c.id],
      }))

    const issues = [...seoIssues, ...perfIssues].sort((a, b) => {
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      if (severityDiff !== 0) return severityDiff
      const catOrder = { seo: 0, performance: 1, sitemap: 2 }
      return (catOrder[a.category] ?? 3) - (catOrder[b.category] ?? 3)
    })

    const issueCount = {
      critical: issues.filter(i => i.severity === 'critical').length,
      warning:  issues.filter(i => i.severity === 'warning').length,
      info:     issues.filter(i => i.severity === 'info').length,
    }

    const result: PageAuditResult = {
      url,
      status:    'success',
      score,
      seoScore:  seoResult.score,
      perfScore: perfResult.score,
      title:     seoResult.meta.title,
      issueCount,
      issues,
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const error = err as Error
    return NextResponse.json(errorResult(url, error.message ?? 'Error al analizar la página.'), { status: 200 })
  }
}

function errorResult(url: string, message: string): PageAuditResult {
  return {
    url,
    status:    'error',
    score:     0,
    seoScore:  0,
    perfScore: 0,
    title:     null,
    issueCount: { critical: 0, warning: 0, info: 0 },
    issues:    [],
    error:     message,
  }
}
