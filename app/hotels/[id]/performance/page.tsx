'use client'
// app/hotels/[id]/performance/page.tsx — Lighthouse + Core Web Vitals (guardado en DB)

import { useEffect, useState } from 'react'
import {
  Loader2, Zap, AlertTriangle, CheckCircle2,
  Monitor, Smartphone, Clock, ChevronDown, ChevronUp,
  AlertCircle, Info,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface HotelInfo { name: string; url: string; country: string }

interface LighthouseMetric {
  value: number; displayValue: string; score: number | null
}
interface LighthouseItem {
  id?:          string
  title:        string
  description?: string
  displayValue?: string
  score:        number | null
}
interface LighthouseResult {
  available:        boolean
  performanceScore: number
  metrics: {
    fcp:        LighthouseMetric
    lcp:        LighthouseMetric
    cls:        LighthouseMetric
    tbt:        LighthouseMetric
    speedIndex: LighthouseMetric
    tti:        LighthouseMetric
  }
  opportunities: LighthouseItem[]
  diagnostics:   LighthouseItem[]
  error?:        string
  saved_at?:     string
  strategy?:     string
}

// ── Prioridad basada en score de Lighthouse ───────────────────────────────────
// score: 0–0.49 → alto (rojo) · 0.5–0.89 → medio (ámbar) · ≥0.9 → bajo (zinc)

type Priority = 'high' | 'medium' | 'low'

function getPriority(score: number | null): Priority {
  if (score === null || score < 0.5)  return 'high'
  if (score < 0.9)                    return 'medium'
  return 'low'
}

const PRIORITY_META: Record<Priority, { label: string; color: string; icon: React.ReactNode }> = {
  high:   { label: 'Alto',  color: 'text-red-400 bg-red-500/10 border-red-500/20',     icon: <AlertCircle  className="w-3.5 h-3.5" /> },
  medium: { label: 'Medio', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  low:    { label: 'Bajo',  color: 'text-zinc-400 bg-zinc-800 border-zinc-700',         icon: <Info          className="w-3.5 h-3.5" /> },
}

// ── Metric helpers ────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  fcp: 'First Contentful Paint', lcp: 'Largest Contentful Paint',
  cls: 'Cumulative Layout Shift', tbt: 'Total Blocking Time',
  speedIndex: 'Speed Index', tti: 'Time to Interactive',
}

function scoreColor(s: number | null): string {
  if (s === null) return 'text-zinc-500'
  if (s >= 0.9)  return 'text-emerald-400'
  if (s >= 0.5)  return 'text-amber-400'
  return 'text-red-400'
}
function scoreBg(s: number | null): string {
  if (s === null) return 'border-zinc-700 bg-zinc-800'
  if (s >= 0.9)  return 'border-emerald-500/30 bg-emerald-500/5'
  if (s >= 0.5)  return 'border-amber-500/30 bg-amber-500/5'
  return 'border-red-500/30 bg-red-500/5'
}

function MetricCard({ label, metric }: { label: string; metric: LighthouseMetric }) {
  return (
    <div className={cn('rounded-xl border p-4', scoreBg(metric.score))}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={cn('text-xl font-bold', scoreColor(metric.score))}>{metric.displayValue}</p>
      {metric.score !== null && (
        <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all',
              metric.score >= 0.9 ? 'bg-emerald-500' : metric.score >= 0.5 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${Math.round(metric.score * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Sección colapsable de items ───────────────────────────────────────────────

function ItemSection({
  title, items, defaultOpen = true,
}: {
  title: string
  items: LighthouseItem[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Agrupar por prioridad
  const high   = items.filter(i => getPriority(i.score) === 'high')
  const medium = items.filter(i => getPriority(i.score) === 'medium')
  const low    = items.filter(i => getPriority(i.score) === 'low')

  const highCount   = high.length
  const mediumCount = medium.length

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header colapsable */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors text-left">
        <span className="text-xs font-semibold text-zinc-300 flex-1">{title}</span>
        <div className="flex items-center gap-2">
          {highCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/20">
              {highCount} alto{highCount > 1 ? 's' : ''}
            </span>
          )}
          {mediumCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/20">
              {mediumCount} medio{mediumCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-zinc-600">{items.length} total</span>
          {open
            ? <ChevronUp   className="w-3.5 h-3.5 text-zinc-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-zinc-800/50">
          {[...high, ...medium, ...low].map((item, i) => {
            const prio = getPriority(item.score)
            const meta = PRIORITY_META[prio]
            return (
              <div key={item.id ?? i} className="flex items-start gap-3 px-4 py-3">
                {/* Badge prioridad */}
                <span className={cn(
                  'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border flex-shrink-0 mt-0.5',
                  meta.color
                )}>
                  {meta.icon}
                  {meta.label}
                </span>
                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{item.description}</p>
                  )}
                </div>
                {/* Valor de mejora estimada */}
                {item.displayValue && (
                  <span className={cn('text-xs font-semibold flex-shrink-0 mt-0.5', meta.color.split(' ')[0])}>
                    {item.displayValue}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PerformancePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [hotel, setHotel]               = useState<HotelInfo | null>(null)
  const [lh, setLh]                     = useState<LighthouseResult | null>(null)
  const [lhLoading, setLhLoading]       = useState(false)
  const [lhPrevLoading, setLhPrevLoading] = useState(true)
  const [lhDevice, setLhDevice]         = useState<'mobile' | 'desktop'>('mobile')
  const [metricsOpen, setMetricsOpen]   = useState(true)
  const [radarOpen, setRadarOpen]       = useState(true)

  useEffect(() => { loadHotel() }, [id])
  useEffect(() => { loadSaved(lhDevice) }, [id, lhDevice])

  async function loadHotel() {
    const r = await fetch(`/api/hotels/${id}`)
    if (r.ok) { const h = await r.json(); setHotel({ name: h.name, url: h.url, country: h.country }) }
  }

  async function loadSaved(strategy: 'mobile' | 'desktop') {
    setLhPrevLoading(true); setLh(null)
    const r = await fetch(`/api/hotels/${id}/lighthouse?strategy=${strategy}`)
    if (r.ok) setLh(await r.json())
    setLhPrevLoading(false)
  }

  async function runLighthouse() {
    setLhLoading(true); setLh(null)
    const r = await fetch(`/api/hotels/${id}/lighthouse`, { method: 'POST' })
    if (r.ok) {
      if (lhDevice === 'desktop') {
        await loadSaved('desktop')
      } else {
        setLh(await r.json())
      }
    }
    setLhLoading(false)
  }

  const radarData = lh?.available ? [
    { metric: 'FCP',   score: Math.round((lh.metrics.fcp.score        ?? 0) * 100) },
    { metric: 'LCP',   score: Math.round((lh.metrics.lcp.score        ?? 0) * 100) },
    { metric: 'CLS',   score: Math.round((lh.metrics.cls.score        ?? 0) * 100) },
    { metric: 'TBT',   score: Math.round((lh.metrics.tbt.score        ?? 0) * 100) },
    { metric: 'Speed', score: Math.round((lh.metrics.speedIndex.score ?? 0) * 100) },
    { metric: 'TTI',   score: Math.round((lh.metrics.tti.score        ?? 0) * 100) },
  ] : []

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {hotel && <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Performance</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {lhPrevLoading
              ? 'Cargando último análisis…'
              : lh?.saved_at
                ? `Guardado: ${format(new Date(lh.saved_at), "d MMM yyyy HH:mm", { locale: es })} · ${lh.strategy ?? lhDevice}`
                : 'Sin análisis guardado'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
            <button onClick={() => setLhDevice('mobile')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                lhDevice === 'mobile' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
              <Smartphone className="w-3.5 h-3.5" /> Mobile
            </button>
            <button onClick={() => setLhDevice('desktop')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                lhDevice === 'desktop' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
          </div>
          <button onClick={runLighthouse} disabled={lhLoading || !hotel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
            {lhLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {lhLoading ? 'Analizando...' : 'Run Lighthouse'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {(lhPrevLoading || lhLoading) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-zinc-400">
            {lhLoading ? 'Analizando con PageSpeed Insights...' : 'Cargando último análisis…'}
          </p>
          {lhLoading && <p className="text-xs text-zinc-600">Puede tardar hasta 40 segundos · se guarda automáticamente</p>}
        </div>
      )}

      {/* Empty state */}
      {!lhPrevLoading && !lhLoading && !lh && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center gap-3 text-center">
          <Zap className="w-10 h-10 text-zinc-700" />
          <p className="text-zinc-400 font-medium">Sin datos de Lighthouse todavía</p>
          <p className="text-zinc-600 text-sm max-w-sm">
            Ejecuta el análisis para obtener Core Web Vitals, métricas y todas las oportunidades de mejora.
          </p>
          <button onClick={runLighthouse} disabled={!hotel}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
            <Zap className="w-4 h-4" /> Run Lighthouse ahora
          </button>
        </div>
      )}

      {/* Error */}
      {!lhLoading && lh && !lh.available && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-400">
          {lh.error ?? 'No se pudo obtener datos de Lighthouse'}
        </div>
      )}

      {/* Results */}
      {!lhLoading && lh?.available && (
        <>
          {/* Score + Radar — colapsable */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button
              onClick={() => setRadarOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className={cn('text-2xl font-black tabular-nums', scoreColor(lh.performanceScore / 100))}>
                  {lh.performanceScore}
                </span>
                <div>
                  <p className="text-xs font-semibold text-zinc-300 text-left">Performance Score</p>
                  <p className="text-xs text-zinc-600 text-left capitalize">{lh.strategy ?? lhDevice}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {lh.saved_at && (
                  <span className="flex items-center gap-1 text-xs text-zinc-600">
                    <Clock className="w-3 h-3" />
                    {format(new Date(lh.saved_at), "d MMM HH:mm", { locale: es })}
                  </span>
                )}
                {radarOpen
                  ? <ChevronUp   className="w-3.5 h-3.5 text-zinc-500" />
                  : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
              </div>
            </button>

            {radarOpen && (
              <div className="p-4">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#27272a" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#71717a', fontSize: 11 }} />
                      <Radar name="Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Métricas individuales — colapsable */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button
              onClick={() => setMetricsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
              <span className="text-xs font-semibold text-zinc-300">Core Web Vitals · métricas detalladas</span>
              {metricsOpen
                ? <ChevronUp   className="w-3.5 h-3.5 text-zinc-500" />
                : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
            </button>
            {metricsOpen && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
                {Object.entries(lh.metrics).map(([key, metric]) => (
                  <MetricCard key={key} label={METRIC_LABELS[key] ?? key} metric={metric} />
                ))}
              </div>
            )}
          </div>

          {/* Oportunidades — colapsable, rankeadas por prioridad */}
          {lh.opportunities.length > 0 && (
            <ItemSection
              title="Oportunidades de mejora"
              items={lh.opportunities}
              defaultOpen={true}
            />
          )}

          {/* Diagnósticos — colapsable, rankeados por prioridad */}
          {lh.diagnostics.length > 0 && (
            <ItemSection
              title="Diagnósticos adicionales"
              items={lh.diagnostics}
              defaultOpen={false}
            />
          )}

          {/* Todo OK */}
          {lh.opportunities.length === 0 && lh.diagnostics.length === 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-400">Sin issues detectados</p>
                <p className="text-xs text-zinc-500 mt-0.5">Esta página pasa todos los audits de Lighthouse.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
