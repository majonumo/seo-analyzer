'use client'
// app/hotels/[id]/audit/page.tsx — Auditoría SEO multi-página con progreso en tiempo real

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Play, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, Wrench, Filter, RotateCcw,
} from 'lucide-react'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PageAuditResult } from '@/lib/types'
import type { AuditIssue, Audit } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type RunState = 'idle' | 'fetching-urls' | 'crawling' | 'saving' | 'done' | 'error'
type SevFilter = 'all' | 'critical' | 'high' | 'low'
type FixFilter = 'all' | 'pending' | 'fixed'

interface ProgressState {
  total:    number
  done:     number
  current:  string
  errors:   number
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEV_LABEL: Record<string, string>  = { critical: 'Crítico', high: 'Alto', low: 'Bajo' }
const SEV_COLOR: Record<string, string>  = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  high:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low:      'text-zinc-400 bg-zinc-800 border-zinc-700',
}

// Mapa legible de tipos de issue
const TYPE_LABELS: Record<string, string> = {
  'seo-title-exists':       'Título faltante',
  'seo-title-length':       'Título muy largo/corto',
  'seo-desc-exists':        'Meta description faltante',
  'seo-desc-length':        'Meta description muy larga/corta',
  'seo-h1-exists':          'H1 faltante',
  'seo-h1-unique':          'H1 duplicado',
  'seo-h2-exists':          'H2 faltante',
  'seo-canonical-exists':   'Canonical faltante',
  'seo-canonical-self':     'Canonical incorrecto',
  'seo-og-title':           'OG title faltante',
  'seo-og-description':     'OG description faltante',
  'seo-og-image':           'OG image faltante',
  'seo-schema-exists':      'Structured data faltante',
  'seo-robots-noindex':     'Página con noindex',
  'perf-html-size':         'HTML muy grande',
  'perf-dom-size':          'DOM muy grande',
  'perf-blocking-scripts':  'Scripts bloqueantes',
  'perf-images-alt':        'Imágenes sin alt',
  'perf-images-dimensions': 'Imágenes sin dimensiones',
  'perf-inline-styles':     'Estilos inline excesivos',
  'perf-deprecated-tags':   'Tags HTML obsoletos',
  'perf-viewport-meta':     'Viewport meta faltante',
  'perf-favicon':           'Favicon faltante',
  'hreflang_wrong_code':    'Hreflang: código inválido',
  'hreflang_no_xdefault':   'Hreflang: falta x-default',
  'hreflang_missing':       'Hreflang no configurado',
}

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number | null }) {
  const s = score ?? 0
  const color = s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-red-400'
  const ring  = s >= 80 ? 'border-emerald-500/30 bg-emerald-500/5'
    : s >= 50 ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-red-500/30 bg-red-500/5'
  return (
    <div className={cn('flex flex-col items-center justify-center w-32 h-32 rounded-2xl border-2', ring)}>
      <span className={cn('text-4xl font-black tabular-nums', color)}>{score !== null ? score : '—'}</span>
      <span className="text-xs text-zinc-500 mt-1">SEO Score</span>
    </div>
  )
}

// ─── Issue row ────────────────────────────────────────────────────────────────

function IssueRow({
  issue, onToggleFix, auditId,
}: {
  issue: AuditIssue & { fixing?: boolean }
  onToggleFix: (id: string, fixed: boolean) => void
  auditId: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'border-b border-zinc-800/50 last:border-0 transition-colors',
      issue.fixed ? 'opacity-50' : '',
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Severity badge */}
        <span className={cn(
          'flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded border',
          SEV_COLOR[issue.severity],
        )}>
          {SEV_LABEL[issue.severity]}
        </span>

        {/* Type + URL */}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium', issue.fixed ? 'line-through text-zinc-600' : 'text-zinc-200')}>
            {TYPE_LABELS[issue.type] ?? issue.type}
          </p>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-400 truncate flex items-center gap-1 w-fit max-w-full"
            onClick={e => e.stopPropagation()}
          >
            {issue.url.replace(/^https?:\/\//, '')}
            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
          </a>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onToggleFix(issue.id, !issue.fixed)}
            disabled={issue.fixing}
            title={issue.fixed ? 'Marcar como pendiente' : 'Marcar como resuelto'}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              issue.fixed
                ? 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20',
            )}
          >
            {issue.fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            {issue.fixed ? 'Resuelto' : 'Resolver'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-zinc-800/40 pt-2 bg-zinc-900/50">
          {issue.description && (
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Descripción</p>
              <p className="text-xs text-zinc-300">{issue.description}</p>
            </div>
          )}
          {issue.recommendation && (
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Cómo resolverlo</p>
              <p className="text-xs text-zinc-300">{issue.recommendation}</p>
            </div>
          )}
          {issue.current_value && (
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Valor actual</p>
              <code className="text-xs text-amber-300 bg-zinc-800 px-2 py-0.5 rounded">{issue.current_value}</code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Score history chart ──────────────────────────────────────────────────────

function ScoreChart({ audits }: { audits: Audit[] }) {
  const completed = audits
    .filter(a => a.status === 'completed' && a.score !== null)
    .slice(0, 8)
    .reverse()
    .map((a, i) => ({
      label: a.completed_at
        ? format(new Date(a.completed_at), 'dd/MM', { locale: es })
        : `#${i + 1}`,
      score: a.score ?? 0,
    }))

  if (completed.length < 2) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-medium text-zinc-400 mb-3">Historial de scores</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={completed}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
            itemStyle={{ color: '#10b981' }}
          />
          <Line
            type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2}
            dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HotelAuditPage({ params }: { params: { id: string } }) {
  const { id } = params

  // Audit runner state
  const [runState, setRunState] = useState<RunState>('idle')
  const [progress, setProgress] = useState<ProgressState>({ total: 0, done: 0, current: '', errors: 0 })
  const [runError, setRunError] = useState('')

  // Results state
  const [latestAudit, setLatestAudit]   = useState<Audit | null>(null)
  const [allAudits, setAllAudits]       = useState<Audit[]>([])
  const [issues, setIssues]             = useState<(AuditIssue & { fixing?: boolean })[]>([])
  const [loadingIssues, setLoadingIssues] = useState(false)

  // Filter state
  const [sevFilter, setSevFilter]   = useState<SevFilter>('all')
  const [fixFilter, setFixFilter]   = useState<FixFilter>('pending')
  const [typeFilter, setTypeFilter] = useState('all')
  const [hotelUrl, setHotelUrl]     = useState('')
  const [hotel, setHotel]           = useState<{ name: string; url: string; country: string } | null>(null)

  useEffect(() => { init() }, [id])

  async function init() {
    const r = await fetch(`/api/hotels/${id}`)
    if (r.ok) {
      const h = await r.json()
      setHotelUrl(h.url)
      setHotel({ name: h.name, url: h.url, country: h.country })
    }
    await loadAudits()
  }

  async function loadAudits() {
    const r = await fetch(`/api/hotels/${id}/audits`)
    if (!r.ok) return
    const data: Audit[] = await r.json()
    setAllAudits(data)
    const latest = data.find(a => a.status === 'completed') ?? null
    setLatestAudit(latest)
    if (latest) await loadIssues(latest.id)
  }

  async function loadIssues(auditId: string) {
    setLoadingIssues(true)
    const r = await fetch(`/api/audit/${auditId}/issues`)
    if (r.ok) setIssues(await r.json())
    setLoadingIssues(false)
  }

  async function handleToggleFix(issueId: string, fixed: boolean) {
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, fixing: true } : i))
    const r = await fetch(`/api/audit/${latestAudit?.id}/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixed }),
    })
    if (r.ok) {
      const updated = await r.json()
      setIssues(prev => prev.map(i =>
        i.id === issueId ? { ...i, fixed: updated.fixed, fixed_at: updated.fixed_at, fixing: false } : i
      ))
    } else {
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, fixing: false } : i))
    }
  }

  const runAudit = useCallback(async () => {
    if (!hotelUrl) return
    setRunState('fetching-urls')
    setRunError('')
    setProgress({ total: 0, done: 0, current: '', errors: 0 })

    try {
      // 1. Crear registro de auditoría
      const startRes = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId: id }),
      })
      const { auditId } = await startRes.json()

      // 2. Obtener URLs del sitemap (deduplicadas)
      const urlsRes = await fetch(`/api/site-audit/urls?url=${encodeURIComponent(hotelUrl)}`)
      const urlsData = await urlsRes.json()
      const rawUrls: string[] = urlsData.found ? urlsData.urls : [hotelUrl]
      // Deduplicar: normalizar quitando trailing slash y hash, luego unique
      const urls = Array.from(new Set(
        rawUrls.map(u => u.replace(/#.*$/, '').replace(/\/$/, '') || u)
      )).slice(0, 50)

      setRunState('crawling')
      setProgress({ total: urls.length, done: 0, current: urls[0] ?? '', errors: 0 })

      // 3. Analizar hreflang de la URL principal
      let hreflangIssues: { type: string; severity: 'critical'|'high'|'low'; description: string; recommendation: string }[] = []
      try {
        const hRes = await fetch('/api/site-audit/hreflang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: hotelUrl }),
        })
        if (hRes.ok) hreflangIssues = (await hRes.json()).issues ?? []
      } catch { /* no-op */ }

      // 4. Crawl página por página (max concurrencia 3)
      const pageResults: { url: string; issues: PageAuditResult['issues'] }[] = []
      const queue = [...urls]
      let errors = 0

      const worker = async () => {
        while (queue.length > 0) {
          const url = queue.shift()!
          setProgress(p => ({ ...p, current: url }))
          try {
            const res = await fetch('/api/site-audit/page', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            })
            const result: PageAuditResult = await res.json()
            if (result.status === 'success') {
              pageResults.push({ url, issues: result.issues })
            } else {
              errors++
            }
          } catch {
            errors++
          }
          setProgress(p => ({ ...p, done: p.done + 1, errors }))
        }
      }

      await Promise.all(Array.from({ length: 3 }, worker))

      // 5. Guardar resultados en Supabase
      setRunState('saving')
      await fetch(`/api/audit/${auditId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId: id, pageResults, hreflangIssues, mainUrl: hotelUrl }),
      })

      // 6. Recargar datos
      await loadAudits()
      setRunState('done')
      setTimeout(() => setRunState('idle'), 2000)
    } catch (e) {
      setRunError((e as Error).message)
      setRunState('error')
    }
  }, [hotelUrl, id])

  // ── Filtered issues ──────────────────────────────────────────────────────
  const allTypes = Array.from(new Set(issues.map(i => i.type))).sort()
  const filtered = issues.filter(i => {
    if (sevFilter !== 'all' && i.severity !== sevFilter) return false
    if (fixFilter === 'pending' && i.fixed) return false
    if (fixFilter === 'fixed' && !i.fixed) return false
    if (typeFilter !== 'all' && i.type !== typeFilter) return false
    return true
  })

  const critCount = issues.filter(i => i.severity === 'critical' && !i.fixed).length
  const highCount = issues.filter(i => i.severity === 'high' && !i.fixed).length
  const lowCount  = issues.filter(i => i.severity === 'low' && !i.fixed).length
  const fixedCount = issues.filter(i => i.fixed).length

  const isRunning = ['fetching-urls', 'crawling', 'saving'].includes(runState)
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {hotel && <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />}
      {/* Run button row */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-zinc-100">Auditoría SEO</h2>
        </div>
        <button
          onClick={runAudit}
          disabled={isRunning || !hotelUrl}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-sm font-semibold transition-colors"
        >
          {isRunning
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Auditando...</>
            : <><Play className="w-4 h-4" /> {latestAudit ? 'Re-auditar' : 'Ejecutar auditoría'}</>}
        </button>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-300">
              {runState === 'fetching-urls' ? 'Obteniendo URLs del sitemap...'
                : runState === 'saving' ? 'Guardando resultados...'
                : `Analizando páginas (${progress.done}/${progress.total})`}
            </span>
            <span className="text-sm font-bold text-emerald-400">{pct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          {progress.current && (
            <p className="text-xs text-zinc-600 mt-2 truncate">↗ {progress.current}</p>
          )}
          {progress.errors > 0 && (
            <p className="text-xs text-amber-500 mt-1">{progress.errors} página(s) con error</p>
          )}
        </div>
      )}

      {/* Done banner */}
      {runState === 'done' && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-400 font-medium">Auditoría completada con éxito</p>
        </div>
      )}

      {/* Error banner */}
      {runState === 'error' && runError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{runError}</p>
        </div>
      )}

      {/* No audit yet */}
      {!latestAudit && runState === 'idle' && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-10 h-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium mb-1">Sin auditorías todavía</p>
          <p className="text-zinc-600 text-sm">Ejecutá la primera auditoría para ver el análisis completo del sitio.</p>
        </div>
      )}

      {/* Results */}
      {latestAudit && !isRunning && (
        <>
          {/* Score + summary */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
            <div className="flex flex-col items-center gap-3 p-5 rounded-xl border border-zinc-800 bg-zinc-900">
              <ScoreGauge score={latestAudit.score} />
              <p className="text-xs text-zinc-600 text-center">
                {latestAudit.completed_at
                  ? format(new Date(latestAudit.completed_at), "d MMM yyyy, HH:mm", { locale: es })
                  : ''}
                <br/>{latestAudit.pages_crawled} páginas analizadas
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Críticos', val: critCount, color: 'text-red-400' },
                { label: 'Altos',    val: highCount, color: 'text-amber-400' },
                { label: 'Bajos',    val: lowCount,  color: 'text-zinc-400' },
                { label: 'Resueltos', val: fixedCount, color: 'text-emerald-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
                  <p className={cn('text-3xl font-black', color)}>{val}</p>
                  <p className="text-xs text-zinc-500 mt-1">{label}</p>
                </div>
              ))}
              {/* Score chart spans 4 cols */}
              <div className="col-span-2 sm:col-span-4">
                <ScoreChart audits={allAudits} />
              </div>
            </div>
          </div>

          {/* Issues table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {/* Table header + filters */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-semibold text-zinc-300 mr-2">
                Issues <span className="text-zinc-600 font-normal">({filtered.length})</span>
              </span>

              {/* Severity filter */}
              <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-0.5">
                {(['all', 'critical', 'high', 'low'] as SevFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setSevFilter(f)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      sevFilter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                    )}
                  >
                    {f === 'all' ? 'Todos' : SEV_LABEL[f]}
                  </button>
                ))}
              </div>

              {/* Fixed filter */}
              <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-0.5">
                {(['all', 'pending', 'fixed'] as FixFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFixFilter(f)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      fixFilter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                    )}
                  >
                    {f === 'all' ? 'Estado' : f === 'pending' ? 'Pendientes' : 'Resueltos'}
                  </button>
                ))}
              </div>

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="ml-auto px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 focus:outline-none focus:border-zinc-600"
              >
                <option value="all">Todos los tipos</option>
                {allTypes.map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>

              {/* Reset */}
              {(sevFilter !== 'all' || fixFilter !== 'pending' || typeFilter !== 'all') && (
                <button
                  onClick={() => { setSevFilter('all'); setFixFilter('pending'); setTypeFilter('all') }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Issues list */}
            {loadingIssues ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="text-sm text-zinc-400 font-medium">
                  {issues.length === 0 ? 'Sin issues detectados' : 'Sin issues con estos filtros'}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map(issue => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    auditId={latestAudit.id}
                    onToggleFix={handleToggleFix}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
