'use client'
// app/hotels/[id]/performance/page.tsx — Lighthouse + issues de performance

import { useEffect, useState } from 'react'
import {
  Loader2, Zap, RefreshCw, AlertTriangle, CheckCircle2,
  Monitor, Smartphone,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import type { AuditIssue } from '@/lib/supabase'

interface HotelInfo { name: string; url: string; country: string }

interface LighthouseMetric {
  value: number; displayValue: string; score: number | null
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
  opportunities: { title: string; displayValue: string; description?: string }[]
  diagnostics:   { title: string; displayValue?: string }[]
  error?:        string
}

const METRIC_LABELS: Record<string, string> = {
  fcp: 'First Contentful Paint', lcp: 'Largest Contentful Paint',
  cls: 'Cumulative Layout Shift', tbt: 'Total Blocking Time',
  speedIndex: 'Speed Index', tti: 'Time to Interactive',
}

const PERF_ISSUE_TYPES = [
  'perf-html-size', 'perf-dom-size', 'perf-blocking-scripts',
  'perf-images-alt', 'perf-images-dimensions', 'perf-inline-styles',
  'perf-deprecated-tags', 'perf-viewport-meta', 'perf-favicon',
  'blocking_scripts', 'large_html', 'large_dom', 'missing_viewport',
]

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
            className={cn('h-full rounded-full transition-all', metric.score >= 0.9 ? 'bg-emerald-500' : metric.score >= 0.5 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${Math.round(metric.score * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function PerformancePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [hotel, setHotel]       = useState<HotelInfo | null>(null)
  const [issues, setIssues]     = useState<AuditIssue[]>([])
  const [lh, setLh]             = useState<LighthouseResult | null>(null)
  const [lhLoading, setLhLoading] = useState(false)
  const [lhDevice, setLhDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [loading, setLoading]   = useState(true)

  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const hr = await fetch(`/api/hotels/${id}`)
    if (!hr.ok) { setLoading(false); return }
    const h = await hr.json()
    setHotel({ name: h.name, url: h.url, country: h.country })

    // Cargar issues de performance del último audit
    const ar = await fetch(`/api/hotels/${id}/audits`)
    if (ar.ok) {
      const audits = await ar.json()
      const latest = audits.find((a: { status: string }) => a.status === 'completed')
      if (latest) {
        const ir = await fetch(`/api/audit/${latest.id}/issues`)
        if (ir.ok) {
          const all: AuditIssue[] = await ir.json()
          setIssues(all.filter(i => PERF_ISSUE_TYPES.includes(i.type) || i.type.startsWith('perf')))
        }
      }
    }
    setLoading(false)
  }

  async function runLighthouse() {
    if (!hotel?.url) return
    setLhLoading(true); setLh(null)
    const url = lhDevice === 'desktop'
      ? hotel.url + (hotel.url.includes('?') ? '&strategy=desktop' : '?strategy=desktop')
      : hotel.url
    const r = await fetch('/api/lighthouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: hotel.url, strategy: lhDevice }),
    })
    if (r.ok) setLh(await r.json())
    setLhLoading(false)
  }

  // Radar data con métricas normalizadas
  const radarData = lh?.available ? [
    { metric: 'FCP',    score: Math.round((lh.metrics.fcp.score ?? 0) * 100) },
    { metric: 'LCP',    score: Math.round((lh.metrics.lcp.score ?? 0) * 100) },
    { metric: 'CLS',    score: Math.round((lh.metrics.cls.score ?? 0) * 100) },
    { metric: 'TBT',    score: Math.round((lh.metrics.tbt.score ?? 0) * 100) },
    { metric: 'Speed',  score: Math.round((lh.metrics.speedIndex.score ?? 0) * 100) },
    { metric: 'TTI',    score: Math.round((lh.metrics.tti.score ?? 0) * 100) },
  ] : []

  const critCount = issues.filter(i => i.severity === 'critical' && !i.fixed).length
  const highCount = issues.filter(i => i.severity === 'high' && !i.fixed).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {hotel && <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Performance</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Lighthouse · Core Web Vitals · Issues de rendimiento</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Device toggle */}
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

      {/* Lighthouse results */}
      {lhLoading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-zinc-400">Analizando con PageSpeed Insights...</p>
          <p className="text-xs text-zinc-600">Puede tardar hasta 40 segundos</p>
        </div>
      )}

      {lh && !lhLoading && (
        <>
          {lh.available ? (
            <div className="space-y-4">
              {/* Overall score + radar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Score */}
                <div className={cn('rounded-xl border-2 p-6 flex flex-col items-center justify-center', scoreBg(lh.performanceScore / 100))}>
                  <p className={cn('text-6xl font-black', scoreColor(lh.performanceScore / 100))}>
                    {lh.performanceScore}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">Performance Score</p>
                  <p className="text-xs text-zinc-600 mt-1 capitalize">{lhDevice}</p>
                </div>

                {/* Radar */}
                <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="text-xs font-medium text-zinc-400 mb-2">Core Web Vitals</p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#27272a" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#71717a', fontSize: 11 }} />
                        <Radar name="Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(lh.metrics).map(([key, metric]) => (
                  <MetricCard key={key} label={METRIC_LABELS[key] ?? key} metric={metric} />
                ))}
              </div>

              {/* Opportunities */}
              {lh.opportunities.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-400">Oportunidades de mejora</p>
                  </div>
                  <div className="divide-y divide-zinc-800/50">
                    {lh.opportunities.map((o, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200">{o.title}</p>
                          {o.description && <p className="text-xs text-zinc-500 mt-0.5">{o.description}</p>}
                        </div>
                        {o.displayValue && (
                          <span className="text-xs text-amber-400 font-medium flex-shrink-0">{o.displayValue}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-400">
              {lh.error ?? 'No se pudo obtener datos de Lighthouse'}
            </div>
          )}
        </>
      )}

      {/* Issues de performance del audit */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-400 flex-1">Issues de rendimiento detectados en auditoría</p>
            {critCount > 0 && (
              <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">
                {critCount} críticos
              </span>
            )}
            {highCount > 0 && (
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
                {highCount} altos
              </span>
            )}
          </div>

          {issues.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 text-center px-6">
              {loading ? (
                <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm text-zinc-400">Sin issues de performance en la última auditoría</p>
                  <p className="text-xs text-zinc-600">Ejecutá una auditoría primero desde la pestaña "Auditoría"</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {issues.map(issue => (
                <div key={issue.id} className={cn('flex items-start gap-3 px-4 py-3',
                  issue.fixed ? 'opacity-40' : '')}>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border flex-shrink-0 mt-0.5',
                    issue.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                    issue.severity === 'high'     ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                                    'text-zinc-400 bg-zinc-800 border-zinc-700')}>
                    {issue.severity === 'critical' ? 'Crítico' : issue.severity === 'high' ? 'Alto' : 'Bajo'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200">{issue.description}</p>
                    {issue.recommendation && (
                      <p className="text-xs text-zinc-500 mt-0.5">{issue.recommendation}</p>
                    )}
                    <p className="text-xs text-zinc-600 mt-1 truncate">{issue.url}</p>
                  </div>
                  {issue.fixed && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
