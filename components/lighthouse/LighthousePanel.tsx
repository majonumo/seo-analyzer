'use client'
// components/lighthouse/LighthousePanel.tsx

import { useEffect, useState } from 'react'
import type { LighthouseResult, LighthouseStrategyData } from '@/lib/types'
import { ScoreRing } from '@/components/shared/ScoreRing'
import { getScoreColor, scoreColorClasses } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import { AlertTriangle, Info, Zap, Loader2, Smartphone, Monitor } from 'lucide-react'

interface Props {
  url: string
  initialData?: LighthouseResult | null
  onLoaded?: (data: LighthouseResult) => void
}

type Strategy = 'mobile' | 'desktop'

export function LighthousePanel({ url, initialData, onLoaded }: Props) {
  const [lighthouse, setLighthouse] = useState<LighthouseResult | null>(initialData ?? null)
  const [loading, setLoading]       = useState(!initialData)
  const [strategy, setStrategy]     = useState<Strategy>('mobile')

  useEffect(() => {
    if (initialData) {
      setLighthouse(initialData)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchLighthouse() {
      setLoading(true)
      try {
        const res  = await fetch('/api/lighthouse', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ url }),
        })
        const data = await res.json() as LighthouseResult
        if (!cancelled) {
          setLighthouse(data)
          onLoaded?.(data)
        }
      } catch {
        const fallback: LighthouseResult = {
          available: false,
          performanceScore: 0,
          metrics: {
            fcp: { value: 0, displayValue: 'N/A', score: null },
            lcp: { value: 0, displayValue: 'N/A', score: null },
            cls: { value: 0, displayValue: 'N/A', score: null },
            tbt: { value: 0, displayValue: 'N/A', score: null },
            speedIndex: { value: 0, displayValue: 'N/A', score: null },
            tti: { value: 0, displayValue: 'N/A', score: null },
          },
          opportunities: [],
          diagnostics: [],
          error: 'Error de red al obtener métricas de Lighthouse.',
        }
        if (!cancelled) {
          setLighthouse(fallback)
          onLoaded?.(fallback)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLighthouse()
    return () => { cancelled = true }
  }, [url, initialData])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-slide-up">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">Obteniendo métricas reales de Lighthouse...</p>
          <p className="text-xs text-zinc-500 mt-1">PageSpeed Insights audita mobile y desktop en paralelo. Puede tomar hasta 30s.</p>
        </div>
      </div>
    )
  }

  if (!lighthouse?.available) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-200 mb-1">Lighthouse no disponible</h3>
            <p className="text-sm text-zinc-400 max-w-md">{lighthouse?.error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Datos de la estrategia activa
  const activeData: LighthouseStrategyData = strategy === 'desktop' && lighthouse.desktop
    ? lighthouse.desktop
    : {
        performanceScore: lighthouse.performanceScore,
        metrics:          lighthouse.metrics,
        opportunities:    lighthouse.opportunities,
        diagnostics:      lighthouse.diagnostics,
      }

  const color  = getScoreColor(activeData.performanceScore)
  const colors = scoreColorClasses[color]

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Score header + toggle */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5">
            <ScoreRing score={activeData.performanceScore} size="md" key={strategy} />
            <div>
              <div className={cn('text-xl font-bold', colors.text)}>
                {activeData.performanceScore >= 90 ? 'Rápido' : activeData.performanceScore >= 50 ? 'Necesita mejoras' : 'Lento'}
              </div>
              <div className="text-zinc-400 text-sm mt-0.5">
                Score Lighthouse ({strategy === 'mobile' ? 'mobile' : 'desktop'})
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-500">90–100 Rápido</span>
                <div className="w-2 h-2 rounded-full bg-amber-500 ml-2" />
                <span className="text-xs text-zinc-500">50–89 Mejoras</span>
                <div className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                <span className="text-xs text-zinc-500">0–49 Lento</span>
              </div>
            </div>
          </div>

          {/* Toggle mobile / desktop */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded-xl p-1">
            <StrategyBtn
              active={strategy === 'mobile'}
              onClick={() => setStrategy('mobile')}
              icon={<Smartphone className="w-3.5 h-3.5" />}
              label="Mobile"
              score={lighthouse.performanceScore}
            />
            <StrategyBtn
              active={strategy === 'desktop'}
              onClick={() => setStrategy('desktop')}
              icon={<Monitor className="w-3.5 h-3.5" />}
              label="Desktop"
              score={lighthouse.desktop?.performanceScore}
              disabled={!lighthouse.desktop}
            />
          </div>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Core Web Vitals & Métricas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="LCP" fullLabel="Largest Contentful Paint" metric={activeData.metrics.lcp} thresholds={{ good: 2500, poor: 4000 }} />
          <MetricCard label="FCP" fullLabel="First Contentful Paint"   metric={activeData.metrics.fcp} thresholds={{ good: 1800, poor: 3000 }} />
          <MetricCard label="CLS" fullLabel="Cumulative Layout Shift"  metric={activeData.metrics.cls} thresholds={{ good: 0.1,  poor: 0.25  }} isDecimal />
          <MetricCard label="TBT" fullLabel="Total Blocking Time"      metric={activeData.metrics.tbt} thresholds={{ good: 200,  poor: 600   }} />
          <MetricCard label="Speed Index" fullLabel="Speed Index"      metric={activeData.metrics.speedIndex} thresholds={{ good: 3400, poor: 5800 }} />
          <MetricCard label="TTI" fullLabel="Time to Interactive"      metric={activeData.metrics.tti} thresholds={{ good: 3800, poor: 7300 }} />
        </div>
      </div>

      {/* Opportunities */}
      {activeData.opportunities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Oportunidades de mejora</h3>
          <div className="space-y-2">
            {activeData.opportunities.map(opp => (
              <AuditRow key={opp.id} title={opp.title} description={opp.description} displayValue={opp.displayValue} score={opp.score} />
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {activeData.diagnostics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Diagnósticos</h3>
          <div className="space-y-2">
            {activeData.diagnostics.map(d => (
              <AuditRow key={d.id} title={d.title} description={d.description} displayValue={d.displayValue} score={d.score} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── StrategyBtn ───────────────────────────────────────────────────────────────

function StrategyBtn({
  active, onClick, icon, label, score, disabled,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  score?: number
  disabled?: boolean
}) {
  const scoreColor = score !== undefined
    ? score >= 90 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
    : 'text-zinc-500'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        active
          ? 'bg-zinc-700 text-zinc-100 shadow-sm'
          : 'text-zinc-500 hover:text-zinc-300',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {icon}
      {label}
      {score !== undefined && (
        <span className={cn('font-mono font-bold', scoreColor)}>{score}</span>
      )}
    </button>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  label, fullLabel, metric, thresholds, isDecimal,
}: {
  label: string
  fullLabel: string
  metric: { value: number; displayValue: string; score: number | null }
  thresholds: { good: number; poor: number }
  isDecimal?: boolean
}) {
  const val    = metric.value
  const status = val === 0 && metric.displayValue === 'N/A'
    ? 'na'
    : val <= thresholds.good ? 'good' : val <= thresholds.poor ? 'warn' : 'poor'

  const colorMap = {
    good: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    warn: { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
    poor: { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20'     },
    na:   { text: 'text-zinc-500',    bg: 'bg-zinc-800/40',    border: 'border-zinc-700'       },
  }
  const c = colorMap[status]

  return (
    <div className={cn('rounded-xl border p-4', c.bg, c.border)}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-zinc-500 font-mono">{label}</span>
        {status !== 'na' && (
          <span className={cn('text-xs font-medium', c.text)}>
            {status === 'good' ? 'Bueno' : status === 'warn' ? 'Mejorar' : 'Lento'}
          </span>
        )}
      </div>
      <div className={cn('text-xl font-bold tabular-nums', c.text)}>
        {metric.displayValue}
      </div>
      <div className="text-xs text-zinc-600 mt-1 leading-tight">{fullLabel}</div>
    </div>
  )
}

// ── AuditRow ──────────────────────────────────────────────────────────────────

function AuditRow({
  title, description, displayValue, score,
}: {
  title: string
  description: string
  displayValue?: string
  score: number | null
}) {
  const s     = score ?? 0
  const color = s >= 0.9 ? 'text-emerald-400' : s >= 0.5 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">{title}</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">{description}</p>
          </div>
        </div>
        {displayValue && (
          <span className={cn('text-xs font-mono flex-shrink-0', color)}>{displayValue}</span>
        )}
      </div>
    </div>
  )
}
