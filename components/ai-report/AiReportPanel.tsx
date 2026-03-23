'use client'
// components/ai-report/AiReportPanel.tsx

import { useEffect, useState } from 'react'
import type { AnalysisResult, AiReport, AiPriorityAction } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Sparkles, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Props { result: AnalysisResult }

const IMPACT_COLOR: Record<AiPriorityAction['impact'], string> = {
  high:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  low:    'text-zinc-400    bg-zinc-700/40    border-zinc-700',
}
const EFFORT_COLOR: Record<AiPriorityAction['effort'], string> = {
  low:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  high:   'text-red-400     bg-red-500/10     border-red-500/20',
}

export function AiReportPanel({ result }: Props) {
  const [report, setReport]   = useState<AiReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchReport() {
      setLoading(true)
      try {
        const res = await fetch('/api/ai-report', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(result),
        })
        if (!cancelled) setReport(await res.json())
      } catch {
        if (!cancelled) setReport({ available: false, error: 'Error de red al obtener el reporte de IA.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchReport()
    return () => { cancelled = true }
  }, [result.url])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-slide-up">
        <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">Generando reporte con IA...</p>
          <p className="text-xs text-zinc-500 mt-1">Gemini está analizando todos los datos. Esto puede tomar unos segundos.</p>
        </div>
      </div>
    )
  }

  if (!report?.available) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-200 mb-1">Reporte de IA no disponible</h3>
            <p className="text-sm text-zinc-400 max-w-md">{report?.error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-violet-300 mb-1">Reporte generado por Gemini AI</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{report.summary}</p>
          </div>
        </div>
      </div>

      {/* Key findings */}
      {report.keyFindings && report.keyFindings.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Hallazgos clave</h3>
          <ul className="space-y-2.5">
            {report.keyFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Priority actions */}
      {report.priorityActions && report.priorityActions.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Acciones prioritarias</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-4 font-medium">Acción</th>
                  <th className="text-left py-2 pr-4 font-medium">Impacto</th>
                  <th className="text-left py-2 font-medium">Esfuerzo</th>
                </tr>
              </thead>
              <tbody>
                {report.priorityActions.map((a, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="py-2.5 pr-4 text-zinc-300">{a.action}</td>
                    <td className="py-2.5 pr-4">
                      <Badge label={a.impact === 'high' ? 'Alto' : a.impact === 'medium' ? 'Medio' : 'Bajo'} className={IMPACT_COLOR[a.impact]} />
                    </td>
                    <td className="py-2.5">
                      <Badge label={a.effort === 'low' ? 'Bajo' : a.effort === 'medium' ? 'Medio' : 'Alto'} className={EFFORT_COLOR[a.effort]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sections */}
      {report.sections && report.sections.length > 0 && (
        <div className="space-y-3">
          {report.sections.map((s, i) => (
            <ExpandableSection key={i} title={s.title} content={s.content} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-medium border', className)}>
      {label}
    </span>
  )
}

// ── ExpandableSection ─────────────────────────────────────────────────────────

function ExpandableSection({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <span className="text-sm font-semibold text-zinc-200">{title}</span>
        {open
          ? <ChevronUp   className="w-4 h-4 text-zinc-500" />
          : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{content}</p>
        </div>
      )}
    </div>
  )
}
