// lib/analyzers/lighthouse.ts
// Llama a Google PageSpeed Insights API v5 para obtener métricas reales de Lighthouse.
// Fetchea mobile y desktop en paralelo.

import type {
  LighthouseResult,
  LighthouseStrategyData,
  LighthouseMetric,
  LighthouseOpportunity,
  LighthouseDiagnostic,
} from '../types'

const PSI_BASE   = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const TIMEOUT_MS = 55_000

function emptyMetric(): LighthouseMetric {
  return { value: 0, displayValue: 'N/A', score: null }
}

function emptyResult(error: string): LighthouseResult {
  return {
    available: false,
    performanceScore: 0,
    metrics: {
      fcp:        emptyMetric(),
      lcp:        emptyMetric(),
      cls:        emptyMetric(),
      tbt:        emptyMetric(),
      speedIndex: emptyMetric(),
      tti:        emptyMetric(),
    },
    opportunities: [],
    diagnostics:   [],
    error,
  }
}

// ─── Parsear un lighthouseResult de la API ────────────────────────────────────

function parseLhr(lhr: Record<string, unknown>): LighthouseStrategyData {
  const audits          = (lhr.audits ?? {}) as Record<string, Record<string, unknown>>
  const performanceScore = Math.round(((lhr.categories as Record<string, Record<string, unknown>>)?.performance?.score as number ?? 0) * 100)

  function getMetric(id: string): LighthouseMetric {
    const a = audits[id]
    if (!a) return emptyMetric()
    return {
      value:        (a.numericValue  as number)  ?? 0,
      displayValue: (a.displayValue  as string)  ?? 'N/A',
      score:        (a.score         as number)  ?? null,
    }
  }

  const opportunities: LighthouseOpportunity[] = []
  const diagnostics:   LighthouseDiagnostic[]  = []

  for (const [id, a] of Object.entries(audits)) {
    if (a.score === 1 || a.score === null) continue
    const score = a.score as number | null
    const base  = {
      id,
      title:       String(a.title       ?? ''),
      description: String(a.description ?? ''),
      score,
    }
    if (a.details && (a.details as Record<string, unknown>).type === 'opportunity') {
      opportunities.push({ ...base, displayValue: String(a.displayValue ?? '') })
    } else if (typeof score === 'number' && score < 0.9) {
      diagnostics.push({ ...base, displayValue: a.displayValue ? String(a.displayValue) : undefined })
    }
  }

  opportunities.sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
  diagnostics.sort((a, b)   => (a.score ?? 1) - (b.score ?? 1))

  return {
    performanceScore,
    metrics: {
      fcp:        getMetric('first-contentful-paint'),
      lcp:        getMetric('largest-contentful-paint'),
      cls:        getMetric('cumulative-layout-shift'),
      tbt:        getMetric('total-blocking-time'),
      speedIndex: getMetric('speed-index'),
      tti:        getMetric('interactive'),
    },
    opportunities: opportunities.slice(0, 10),
    diagnostics:   diagnostics.slice(0, 10),
  }
}

// ─── Fetch de una estrategia ──────────────────────────────────────────────────

async function fetchStrategy(
  url: string,
  strategy: 'mobile' | 'desktop',
  apiKey: string,
  signal: AbortSignal,
): Promise<LighthouseStrategyData | null> {
  const params = new URLSearchParams({ url, strategy, key: apiKey, category: 'performance' })
  const res    = await fetch(`${PSI_BASE}?${params}`, { signal })
  if (!res.ok) return null
  const data = await res.json()
  const lhr  = data.lighthouseResult as Record<string, unknown> | undefined
  if (!lhr) return null
  return parseLhr(lhr)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function analyzeLighthouse(url: string): Promise<LighthouseResult> {
  const apiKey = process.env.PAGESPEED_API_KEY

  if (!apiKey) {
    return emptyResult(
      'Configurá PAGESPEED_API_KEY en .env.local para activar métricas reales de Lighthouse. ' +
      'Obtené una gratis en console.cloud.google.com → PageSpeed Insights API.'
    )
  }

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // Mobile y desktop en paralelo
    const [mobile, desktop] = await Promise.all([
      fetchStrategy(url, 'mobile',  apiKey, controller.signal),
      fetchStrategy(url, 'desktop', apiKey, controller.signal),
    ])

    if (!mobile) return emptyResult('No se pudo obtener datos de PageSpeed API.')

    return {
      available:      true,
      performanceScore: mobile.performanceScore,
      metrics:          mobile.metrics,
      opportunities:    mobile.opportunities,
      diagnostics:      mobile.diagnostics,
      desktop:          desktop ?? undefined,
    }
  } catch (err) {
    const e = err as Error
    if (e.name === 'AbortError') return emptyResult('PageSpeed API tardó más de 55s en responder.')
    return emptyResult(e.message)
  } finally {
    clearTimeout(timer)
  }
}
