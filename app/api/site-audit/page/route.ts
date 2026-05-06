// app/api/site-audit/page/route.ts
// POST /api/site-audit/page — analiza una sola página (SEO + Performance, sin Lighthouse ni sitemap)

import { NextRequest, NextResponse } from 'next/server'
import type { PageAuditResult, Issue } from '@/lib/types'
import { fetchPage }          from '@/lib/analyzers'
import { analyzeSeo }         from '@/lib/analyzers/seo'
import { analyzePerformance } from '@/lib/analyzers/performance'
import { calculateGlobalScore } from '@/lib/scoring'
import { SEVERITY_ORDER, CATEGORY_ORDER, HOW_TO_FIX, DOCS_URLS } from '@/lib/constants'

export const maxDuration = 20

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
      return (CATEGORY_ORDER[a.category] ?? 3) - (CATEGORY_ORDER[b.category] ?? 3)
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
