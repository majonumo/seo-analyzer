// lib/analyzers/index.ts
// Orquestador principal. Fetcha el HTML y corre todos los módulos en paralelo.

import type { AnalysisResult, Issue, LighthouseOpportunity, LighthouseDiagnostic } from '../types'
import { analyzeSeo }         from './seo'
import { analyzePerformance } from './performance'
import { analyzeLighthouse }  from './lighthouse'
import { analyzeSitemap }     from './sitemap'
import { calculateGlobalScore } from '../scoring'
import { SEVERITY_ORDER, CATEGORY_ORDER, HOW_TO_FIX, DOCS_URLS } from '../constants'

const FETCH_TIMEOUT_MS = 8_000

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchPage(url: string): Promise<{ html: string; sizeBytes: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SEOAnalyzerBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html      = await response.text()
    const sizeBytes = new TextEncoder().encode(html).length

    return { html, sizeBytes }
  } catch (err) {
    const error = err as Error
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('Fetch timeout'), { code: 'fetch_timeout' })
    }
    throw Object.assign(new Error(error.message), { code: 'url_unreachable' })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Issues consolidator ──────────────────────────────────────────────────────

function buildIssues(
  seo:  ReturnType<typeof analyzeSeo>,
  perf: ReturnType<typeof analyzePerformance>,
  sitemap: Awaited<ReturnType<typeof analyzeSitemap>>,
): Issue[] {
  const seoIssues: Issue[] = seo.checks
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

  const perfIssues: Issue[] = perf.checks
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

  const sitemapIssues: Issue[] = sitemap.checks
    .filter(c => c.status !== 'pass')
    .map(c => ({
      id:          c.id,
      category:    'sitemap' as const,
      severity:    c.status === 'fail' ? c.severity : ('warning' as const),
      title:       c.label,
      description: c.value ?? `Check ${c.label} falló.`,
      how_to_fix:  HOW_TO_FIX[c.id] ?? 'Revisar la documentación correspondiente.',
      value:       c.value,
      docs_url:    DOCS_URLS[c.id],
    }))

  return [...seoIssues, ...perfIssues, ...sitemapIssues].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (severityDiff !== 0) return severityDiff
    return (CATEGORY_ORDER[a.category] ?? 3) - (CATEGORY_ORDER[b.category] ?? 3)
  })
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runAnalysis(url: string): Promise<AnalysisResult> {
  // Fetch HTML, análisis estáticos y Sitemap en paralelo.
  // Lighthouse se carga por separado via /api/lighthouse (lazy, no bloquea).
  const [{ html, sizeBytes }, sitemapResult] = await Promise.all([
    fetchPage(url),
    analyzeSitemap(url),
  ])

  // Resultado vacío para lighthouse (se cargará on-demand)
  const lighthouseResult = {
    available: false as const,
    performanceScore: 0,
    metrics: {
      fcp:        { value: 0, displayValue: 'N/A', score: null },
      lcp:        { value: 0, displayValue: 'N/A', score: null },
      cls:        { value: 0, displayValue: 'N/A', score: null },
      tbt:        { value: 0, displayValue: 'N/A', score: null },
      speedIndex: { value: 0, displayValue: 'N/A', score: null },
      tti:        { value: 0, displayValue: 'N/A', score: null },
    },
    opportunities: [] as LighthouseOpportunity[],
    diagnostics:   [] as LighthouseDiagnostic[],
    error: undefined as string | undefined,
  }

  const [seoResult, perfResult] = await Promise.all([
    analyzeSeo(html, url),
    analyzePerformance(html, sizeBytes, url),
  ])

  const issues      = buildIssues(seoResult, perfResult, sitemapResult)
  const globalScore = calculateGlobalScore(
    seoResult.score,
    perfResult.score,
    lighthouseResult.available ? lighthouseResult.performanceScore : undefined,
  )

  return {
    url,
    analyzedAt:  new Date().toISOString(),
    globalScore,
    seo:         seoResult,
    performance: perfResult,
    lighthouse:  lighthouseResult,
    sitemap:     sitemapResult,
    issues,
  }
}
