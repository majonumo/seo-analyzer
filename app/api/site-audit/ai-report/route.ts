// app/api/site-audit/ai-report/route.ts
// POST /api/site-audit/ai-report
// Genera un reporte IA específico para Site Audit:
// incluye URL afectada, descripción del error y qué hacer en cada issue.

import { NextRequest, NextResponse } from 'next/server'
import type { PageAuditResult, AiReport, AiPriorityAction, AiReportSection } from '@/lib/types'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
const TIMEOUT_MS  = 35_000

export const maxDuration = 40

interface LighthousePage {
  url:          string
  mobileScore:  number
  desktopScore?: number
  opportunities: { title: string; displayValue: string }[]
  diagnostics:   { title: string; displayValue?: string }[]
}

interface RequestBody {
  pages:           PageAuditResult[]
  domain:          string
  lighthousePages?: LighthousePage[]
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      available: false,
      error: 'Configurá GEMINI_API_KEY en .env.local.',
    } satisfies AiReport)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ available: false, error: 'Body inválido.' } satisfies AiReport, { status: 400 })
  }

  const { pages, domain, lighthousePages } = body
  if (!pages?.length) {
    return NextResponse.json({ available: false, error: 'Sin datos de páginas.' } satisfies AiReport)
  }

  const prompt = buildPrompt(pages, domain, lighthousePages ?? [])

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
      method:  'POST',
      signal:  controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.3,
          maxOutputTokens: 8000,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ available: false, error: `Gemini API error ${res.status}: ${text.slice(0, 300)}` } satisfies AiReport)
    }

    const data         = await res.json()
    const candidate    = data.candidates?.[0]
    const rawText      = candidate?.content?.parts?.[0]?.text ?? ''
    const finishReason = candidate?.finishReason ?? ''

    if (finishReason === 'MAX_TOKENS' && !rawText) {
      return NextResponse.json({ available: false, error: 'La respuesta de Gemini fue cortada (muy larga). Intentá con menos páginas.' } satisfies AiReport)
    }

    return NextResponse.json(parseGeminiResponse(rawText, finishReason))
  } catch (err) {
    const e = err as Error
    const msg = e.name === 'AbortError' ? 'Gemini tardó demasiado en responder.' : e.message
    return NextResponse.json({ available: false, error: msg } satisfies AiReport)
  } finally {
    clearTimeout(timer)
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(pages: PageAuditResult[], domain: string, lighthousePages: LighthousePage[]): string {
  const total    = pages.length
  const success  = pages.filter(p => p.status === 'success')
  const failed   = pages.filter(p => p.status === 'error')
  const avgScore = success.length ? Math.round(success.reduce((s, p) => s + p.score, 0) / success.length) : 0
  const avgSeo   = success.length ? Math.round(success.reduce((s, p) => s + p.seoScore, 0) / success.length) : 0
  const avgPerf  = success.length ? Math.round(success.reduce((s, p) => s + p.perfScore, 0) / success.length) : 0
  const totalCrit = pages.reduce((s, p) => s + p.issueCount.critical, 0)
  const totalWarn = pages.reduce((s, p) => s + p.issueCount.warning, 0)

  // TODAS las páginas — tabla compacta ordenada por score
  const allPagesSorted = [...success].sort((a, b) => a.score - b.score)
  const allPagesTable = allPagesSorted.map(p => {
    const critW = p.issueCount.critical > 0 ? ` ${p.issueCount.critical}C` : ''
    const warnW = p.issueCount.warning  > 0 ? ` ${p.issueCount.warning}W`  : ''
    return `  ${p.url} | ${p.score}/100 | SEO:${p.seoScore} | Perf:${p.perfScore}${critW}${warnW}`
  }).join('\n')

  // Issues detallados para páginas con problemas (top 20 páginas, top 5 issues c/u)
  const pagesWithIssues = allPagesSorted.filter(p => p.issues.length > 0).slice(0, 20)
  const detailedIssues = pagesWithIssues.map(p => {
    const issues = p.issues.slice(0, 5).map(i =>
      `    [${i.severity.toUpperCase()}] ${i.title}${i.value ? ` (${i.value})` : ''}\n      Descripción: ${i.description}\n      Solución: ${i.how_to_fix}`
    ).join('\n')
    return `  URL: ${p.url}\n  Score: ${p.score}/100 | SEO: ${p.seoScore} | Perf: ${p.perfScore}\n${issues}`
  }).join('\n\n')

  // Top issues globales
  const issueMap = new Map<string, { title: string; severity: string; count: number; how_to_fix: string }>()
  for (const p of pages) {
    for (const i of p.issues) {
      if (issueMap.has(i.id)) issueMap.get(i.id)!.count++
      else issueMap.set(i.id, { title: i.title, severity: i.severity, count: 1, how_to_fix: i.how_to_fix })
    }
  }
  const topGlobal = Array.from(issueMap.values())
    .sort((a, b) => b.count - a.count).slice(0, 10)
    .map(i => `  - [${i.severity.toUpperCase()}] ${i.title} (${i.count}/${total} páginas) → ${i.how_to_fix}`)
    .join('\n')

  // Sección Lighthouse
  const lighthouseSection = lighthousePages.length > 0
    ? `\nLIGHTHOUSE — PÁGINAS DE NAVEGACIÓN PRINCIPAL:\n` + lighthousePages.map(lp => {
        const desktop = lp.desktopScore !== undefined ? ` | Desktop: ${lp.desktopScore}/100` : ''
        const opps = lp.opportunities.slice(0, 4).map(o => `    → ${o.title}${o.displayValue ? ` (${o.displayValue})` : ''}`).join('\n')
        const diags = lp.diagnostics.slice(0, 3).map(d => `    · ${d.title}${d.displayValue ? ` (${d.displayValue})` : ''}`).join('\n')
        return `  ${lp.url} | Mobile: ${lp.mobileScore}/100${desktop}\n${opps || '    (sin oportunidades)'}${diags ? '\n  Diagnósticos:\n' + diags : ''}`
      }).join('\n\n')
    : ''

  const failedSection = failed.length > 0
    ? `\nPÁGINAS CON ERROR (${failed.length}): ${failed.map(p => p.url).join(', ')}`
    : ''

  return `Eres un experto en SEO técnico y performance web. Analizá la auditoría completa del sitio "${domain}" y generá un reporte profesional en español.

RESUMEN:
- Dominio: ${domain}
- Páginas auditadas: ${total} (${success.length} OK, ${failed.length} con error)
- Score global promedio: ${avgScore}/100
- SEO promedio: ${avgSeo}/100
- Performance promedio: ${avgPerf}/100
- Issues críticos totales: ${totalCrit}
- Advertencias totales: ${totalWarn}

TODAS LAS PÁGINAS AUDITADAS (ordenadas por score, peor primero):
  [URL | Score | SEO | Perf | C=críticos W=warnings]
${allPagesTable}${failedSection}

ISSUES MÁS FRECUENTES EN TODO EL SITIO:
${topGlobal}

ISSUES DETALLADOS POR URL (páginas con problemas):
${detailedIssues}
${lighthouseSection}

Respondé ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "available": true,
  "summary": "Párrafo de 3-4 oraciones con evaluación general del sitio, mencionando el score promedio y los problemas más críticos.",
  "keyFindings": [
    "Hallazgo 1: mencioná la URL exacta afectada y el impacto concreto",
    "Hallazgo 2: mencioná URLs específicas",
    "Hallazgo 3",
    "Hallazgo 4",
    "Hallazgo 5"
  ],
  "priorityActions": [
    { "action": "Acción concreta con URL específica si aplica", "impact": "high", "effort": "low" },
    { "action": "Acción 2 con URL si aplica", "impact": "high", "effort": "medium" },
    { "action": "Acción 3", "impact": "medium", "effort": "low" },
    { "action": "Acción 4", "impact": "medium", "effort": "medium" },
    { "action": "Acción 5", "impact": "low", "effort": "high" }
  ],
  "sections": [
    {
      "title": "Problemas Críticos por URL",
      "content": "Para cada URL con issues críticos: listá la URL exacta, el error específico encontrado, su descripción y cómo resolverlo. Sé exhaustivo."
    },
    {
      "title": "Lighthouse — Velocidad de Páginas Principales",
      "content": "Analizá los resultados de Lighthouse por página. Mencioná las URLs con peores scores mobile/desktop, las oportunidades de mejora más impactantes y cómo resolverlas."
    },
    {
      "title": "Patrones SEO del Sitio",
      "content": "Qué problemas SEO se repiten en múltiples páginas. Cuáles URLs los tienen. Qué impacto tienen en el posicionamiento y cómo resolverlos sistemáticamente."
    },
    {
      "title": "Plan de Acción Priorizado",
      "content": "Plan concreto en 3 fases: 1) Qué hacer hoy (impacto alto, esfuerzo bajo), 2) Esta semana (impacto alto), 3) Este mes. Con URLs específicas en cada paso."
    }
  ]
}`
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseGeminiResponse(text: string, finishReason?: string): AiReport {
  try {
    // Strip markdown fences if present
    let clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

    // If truncated (MAX_TOKENS), try to close the JSON so it parses partially
    if (finishReason === 'MAX_TOKENS') {
      const depth = (clean.match(/\{/g)?.length ?? 0) - (clean.match(/\}/g)?.length ?? 0)
      for (let i = 0; i < depth; i++) clean += '}'
      // Close any open arrays
      const arrDepth = (clean.match(/\[/g)?.length ?? 0) - (clean.match(/\]/g)?.length ?? 0)
      for (let i = 0; i < arrDepth; i++) clean = clean + ']'
    }

    const parsed = JSON.parse(clean)
    if (!parsed.summary && !Array.isArray(parsed.keyFindings)) throw new Error('Estructura incompleta')
    return {
      available:       true,
      summary:         parsed.summary ? String(parsed.summary) : 'Reporte generado parcialmente.',
      keyFindings:     Array.isArray(parsed.keyFindings) ? (parsed.keyFindings as unknown[]).map(String) : [],
      priorityActions: Array.isArray(parsed.priorityActions) ? (parsed.priorityActions as AiPriorityAction[]).slice(0, 8) : [],
      sections:        Array.isArray(parsed.sections)        ? (parsed.sections        as AiReportSection[]).slice(0, 6)  : [],
    }
  } catch {
    return { available: false, error: `No se pudo parsear la respuesta de Gemini.${finishReason === 'MAX_TOKENS' ? ' (respuesta cortada por límite de tokens)' : ''}` }
  }
}
