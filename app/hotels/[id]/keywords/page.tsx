'use client'
// app/hotels/[id]/keywords/page.tsx — rankings GSC + quick wins + position chart + Google Trends

import { useEffect, useState } from 'react'
import {
  Loader2, RefreshCw, TrendingUp,
  Download, Search, Info, X, Activity, ArrowUpRight,
  ChevronDown, ChevronUp, Sparkles, Target, Trash2,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
  AreaChart, Area,
} from 'recharts'
import { cn } from '@/lib/utils'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Keyword } from '@/lib/supabase'

// ── Tipos Google Trends ────────────────────────────────────────────────────────

interface TrendPoint   { date: string; value: number }
interface RelatedQuery { query: string; value: number | string }
interface KeywordTrend {
  id:         string
  keyword:    string
  geo:        string
  month:      string
  interest:   TrendPoint[]
  rising:     RelatedQuery[]
  top:        RelatedQuery[]
  updated_at: string
}
interface TrendQuickWin {
  trend_query:     string
  trend_value:     string | number
  seed_keyword:    string
  gsc_keyword?:    string
  gsc_position?:   number
  gsc_impressions?: number
  gsc_ctr?:        number
  action:          'optimize' | 'create'
}
interface TrendsResponse {
  trends:      KeywordTrend[]
  quick_wins:  TrendQuickWin[]
  month:       string
}

const TREND_COLORS = ['#34d399', '#60a5fa', '#f59e0b']

// ── Google Trends Section ──────────────────────────────────────────────────────

function GoogleTrendsSection({ hotelId }: { hotelId: string }) {
  const [data,     setData]     = useState<TrendsResponse | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(false)
  const [msg,      setMsg]      = useState('')
  const [winsOpen, setWinsOpen] = useState(true)
  const [trendsOpen, setTrendsOpen] = useState(false)

  useEffect(() => { load() }, [hotelId])

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/hotels/${hotelId}/keywords/trends`)
    if (r.ok) setData(await r.json())
    setLoading(false)
  }

  async function handleUpdate() {
    setUpdating(true); setMsg('')
    const r = await fetch(`/api/hotels/${hotelId}/keywords/trends`, { method: 'POST' })
    const json = await r.json()
    if (r.ok) {
      setMsg(`✓ Trends actualizados — ${json.trends_saved} nichos · ${json.quick_wins?.length ?? 0} quick wins`)
      await load()
    } else {
      setMsg(`✗ ${json.error}`)
    }
    setUpdating(false)
  }

  async function handleDelete(id: string) {
    const r = await fetch(`/api/hotels/${hotelId}/keywords/trends?id=${id}`, { method: 'DELETE' })
    if (r.ok) setData(prev => prev ? { ...prev, trends: prev.trends.filter(t => t.id !== id) } : prev)
  }

  const trends    = data?.trends     ?? []
  const quickWins = data?.quick_wins ?? []
  const month     = data?.month
  const updatedAt = trends[0]?.updated_at
  const optimizeWins = quickWins.filter(w => w.action === 'optimize')
  const createWins   = quickWins.filter(w => w.action === 'create')

  return (
    <div className="mt-10 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Trends de nicho · Quick Wins</h3>
          {month && (
            <span className="text-xs text-zinc-500">
              · {month}
              {updatedAt && ` · ${format(new Date(updatedAt), "d MMM HH:mm", { locale: es })}`}
            </span>
          )}
        </div>
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {updating ? 'Actualizando…' : 'Actualizar Trends'}
        </button>
      </div>

      {/* Explicación del modo automático */}
      {!updating && trends.length === 0 && !loading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex gap-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-1">Trends automáticos por nicho</p>
            <p className="text-xs text-zinc-500">
              Presioná "Actualizar Trends" para traer las búsquedas en alza de los nichos
              <span className="text-zinc-300"> hoteles, turismo y hospedaje</span> en el destino del hotel.
              Estos se cruzan con tus keywords de GSC para generar quick wins accionables.
            </p>
          </div>
        </div>
      )}

      {/* Estado de actualización */}
      {msg && (
        <p className={cn('text-xs px-1', msg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400')}>{msg}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
      ) : trends.length > 0 && (
        <>
          {/* ── Quick Wins colapsable ── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button
              onClick={() => setWinsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-200">Quick Wins desde Trends + GSC</span>
              </div>
              <div className="flex items-center gap-2">
                {optimizeWins.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    {optimizeWins.length} optimizar
                  </span>
                )}
                {createWins.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">
                    {createWins.length} crear
                  </span>
                )}
                {winsOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
              </div>
            </button>

            {winsOpen && (
              <div className="divide-y divide-zinc-800/50">
                {quickWins.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-zinc-600">
                      Sin quick wins por ahora. Sincronizá GSC para cruzar datos.
                    </p>
                  </div>
                ) : (
                  quickWins.map((w, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      {/* Acción badge */}
                      <span className={cn(
                        'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border flex-shrink-0 mt-0.5',
                        w.action === 'optimize'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                      )}>
                        {w.action === 'optimize' ? <Target className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {w.action === 'optimize' ? 'Optimizar' : 'Crear'}
                      </span>

                      <div className="flex-1 min-w-0">
                        {/* Trending query */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-zinc-200">{w.trend_query}</p>
                          <span className="text-xs text-amber-400 font-mono">
                            {typeof w.trend_value === 'string' && w.trend_value === 'Breakout'
                              ? '🔥 Breakout'
                              : `+${w.trend_value}%`}
                          </span>
                        </div>
                        {/* GSC match */}
                        {w.gsc_keyword && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Rankea en <span className="text-zinc-300">#{w.gsc_position}</span> con
                            &ldquo;<span className="text-zinc-400">{w.gsc_keyword}</span>&rdquo;
                            · {w.gsc_impressions?.toLocaleString()} impr.
                            · CTR {w.gsc_ctr !== undefined ? `${(w.gsc_ctr * 100).toFixed(1)}%` : '—'}
                          </p>
                        )}
                        {!w.gsc_keyword && (
                          <p className="text-xs text-zinc-600 mt-0.5">No rankea todavía — oportunidad de contenido nuevo</p>
                        )}
                        <p className="text-xs text-zinc-700 mt-0.5">Nicho: {w.seed_keyword}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Trends por nicho colapsable ── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button
              onClick={() => setTrendsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-400">Interés por nicho · últimos 12 meses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">{trends.length} nichos</span>
                {trendsOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
              </div>
            </button>

            {trendsOpen && (
              <div className="p-4 grid gap-4">
                {trends.map((trend, idx) => (
                  <TrendCard key={trend.id} trend={trend} color={TREND_COLORS[idx % TREND_COLORS.length]} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TrendCard({ trend, color, onDelete }: { trend: KeywordTrend; color: string; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const hasData = trend.interest?.length > 0
  const maxVal  = hasData ? Math.max(...trend.interest.map(p => p.value)) : 0
  const avgVal  = hasData
    ? Math.round(trend.interest.reduce((s, p) => s + p.value, 0) / trend.interest.length)
    : 0

  async function handleDelete() {
    if (!confirm(`¿Eliminar trend "${trend.keyword}"?`)) return
    setDeleting(true)
    await onDelete(trend.id)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">{trend.keyword}</p>
          <p className="text-xs text-zinc-500">{trend.geo || 'Global'} · pico {maxVal} · promedio {avgVal}</p>
        </div>
        <div className="flex items-center gap-3 text-right text-xs">
          <div><p className="text-zinc-600">Pico</p><p className="font-bold" style={{ color }}>{maxVal}</p></div>
          <div><p className="text-zinc-600">Prom.</p><p className="font-bold text-zinc-400">{avgVal}</p></div>
          <button onClick={handleDelete} disabled={deleting}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {hasData ? (
        <div className="h-28 px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.interest} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${trend.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color }}
                formatter={(v) => [Number(v), 'Interés']}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
                fill={`url(#grad-${trend.id})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center">
          <p className="text-xs text-zinc-600">Sin datos de interés</p>
        </div>
      )}

      {(trend.rising?.length > 0 || trend.top?.length > 0) && (
        <div className="border-t border-zinc-800 grid grid-cols-2 divide-x divide-zinc-800">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-amber-400 mb-1.5 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> En alza
            </p>
            <ul className="space-y-1">
              {(trend.rising ?? []).slice(0, 5).map((q, i) => (
                <li key={i} className="flex items-center justify-between gap-1">
                  <span className="text-xs text-zinc-400 truncate">{q.query}</span>
                  <span className="text-xs text-amber-500 font-mono flex-shrink-0">{q.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-zinc-500 mb-1.5">Top búsquedas</p>
            <ul className="space-y-1">
              {(trend.top ?? []).slice(0, 5).map((q, i) => (
                <li key={i} className="flex items-center justify-between gap-1">
                  <span className="text-xs text-zinc-400 truncate">{q.query}</span>
                  <span className="text-xs text-zinc-600 font-mono flex-shrink-0">{q.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

interface HotelInfo { name: string; url: string; country: string; gsc_property: string | null }

type KwTab  = 'all' | 'quickwins' | 'top'
type DayOpt = 7 | 30 | 90

const DAY_OPTS: DayOpt[] = [7, 30, 90]
const TAB_LABELS: Record<KwTab, string> = { all: 'Todas', quickwins: 'Quick Wins', top: 'Top 20' }

function PosBadge({ pos }: { pos: number | null }) {
  if (!pos) return <span className="text-zinc-600">—</span>
  const color = pos <= 3 ? 'text-emerald-400' : pos <= 10 ? 'text-blue-400' : pos <= 20 ? 'text-amber-400' : 'text-zinc-400'
  return <span className={cn('font-bold tabular-nums', color)}>{pos.toFixed(1)}</span>
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%` }

function exportCSV(keywords: Keyword[], filename: string) {
  const header = 'Keyword,Posición,Clics,Impresiones,CTR,Fecha,País,Dispositivo'
  const rows = keywords.map(k =>
    `"${k.keyword}",${k.position ?? ''},${k.clicks},${k.impressions},${pct(k.ctr ?? 0)},${k.date},${k.country ?? ''},${k.device ?? ''}`
  )
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function KeywordsPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [hotel, setHotel]       = useState<HotelInfo | null>(null)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState('')
  const [tab, setTab]             = useState<KwTab>('all')
  const [days, setDays]           = useState<DayOpt>(90)
  const [search, setSearch]       = useState('')
  const [selectedKw, setSelectedKw] = useState<string | null>(null)
  const [tableOpen, setTableOpen]   = useState(true)

  useEffect(() => { init() }, [id])
  useEffect(() => { loadKeywords() }, [tab, days])

  async function init() {
    const r = await fetch(`/api/hotels/${id}`)
    if (r.ok) setHotel(await r.json())
    await loadKeywords()
  }

  async function loadKeywords() {
    setLoading(true)
    const mode = tab !== 'all' ? `&mode=${tab}` : ''
    const r = await fetch(`/api/hotels/${id}/keywords?days=${days}${mode}`)
    if (r.ok) setKeywords(await r.json())
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg('')
    const r = await fetch(`/api/hotels/${id}/keywords/sync`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    })
    const json = await r.json()
    if (r.ok) {
      setSyncMsg(`✓ ${json.synced} keywords sincronizadas`)
      await loadKeywords()
    } else {
      setSyncMsg(`✗ ${json.error}${json.setup ? ` — ${json.setup}` : ''}`)
    }
    setSyncing(false)
  }

  const filtered = keywords.filter(k =>
    !search || k.keyword.toLowerCase().includes(search.toLowerCase())
  )

  const gscNotConfigured = !hotel?.gsc_property
  const gscCredsNotSet   = syncMsg.includes('GSC no configurado')

  return (
    <div className="max-w-5xl mx-auto">
      {hotel && <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-zinc-100">Keywords</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Datos de Google Search Console · {keywords.length} keywords</p>
        </div>

        {/* Day selector */}
        <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
          {DAY_OPTS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors',
                days === d ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
              {d}d
            </button>
          ))}
        </div>

        {/* Sync */}
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors disabled:opacity-50">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync GSC
        </button>

        {/* Export */}
        {keywords.length > 0 && (
          <button onClick={() => exportCSV(filtered, `keywords-${id}-${days}d.csv`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
        )}
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div className={cn('rounded-lg px-4 py-2.5 text-sm mb-4',
          syncMsg.startsWith('✓') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          : 'bg-red-500/10 border border-red-500/20 text-red-400')}>
          {syncMsg}
        </div>
      )}

      {/* GSC not configured notice */}
      {gscNotConfigured && keywords.length === 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 mb-6 flex gap-3">
          <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400 mb-1">GSC no configurado en este hotel</p>
            <p className="text-xs text-zinc-400">
              Para sincronizar keywords reales de Google Search Console:
            </p>
            <ol className="text-xs text-zinc-500 mt-1.5 space-y-0.5 list-decimal list-inside">
              <li>Edita el hotel y agrega la URL exacta de la propiedad GSC</li>
              <li>Agrega <code className="text-zinc-400">GOOGLE_GSC_CLIENT_EMAIL</code> y <code className="text-zinc-400">GOOGLE_GSC_PRIVATE_KEY</code> al .env.local</li>
              <li>Crea una Service Account en Google Cloud Console con acceso a la propiedad</li>
            </ol>
          </div>
        </div>
      )}

      {/* Quick wins explanation */}
      {tab === 'quickwins' && (
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-4 py-2.5 text-xs text-blue-400 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 flex-shrink-0" />
          Keywords en posición 6–20, con más de 50 impresiones y CTR menor al 3%. Alta oportunidad de mejora con poco esfuerzo.
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-zinc-800 mb-5">
        {(Object.entries(TAB_LABELS) as [KwTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300')}>
            {label}
            {t === 'quickwins' && keywords.length > 0 && tab !== 'quickwins' && (
              <span className="ml-1.5 text-xs bg-amber-500/20 text-amber-400 rounded px-1">!</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {keywords.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar keywords..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
        </div>
      )}

      {/* Position chart for selected keyword */}
      {selectedKw && (() => {
        const kwHistory = keywords
          .filter(k => k.keyword === selectedKw && k.position != null)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(k => ({
            date: format(new Date(k.date), 'd MMM', { locale: es }),
            pos:  Number(k.position?.toFixed(1)),
          }))
        return (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-zinc-100 truncate max-w-xs">{selectedKw}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Evolución de posición — últimos {days}d</p>
              </div>
              <button onClick={() => setSelectedKw(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            {kwHistory.length < 2 ? (
              <p className="text-xs text-zinc-600 py-4 text-center">
                Se necesitan al menos 2 registros históricos para mostrar el gráfico.
                Sincronizá GSC en diferentes fechas para ver la evolución.
              </p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kwHistory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
                    {/* Invertido: posición 1 arriba, 20 abajo */}
                    <YAxis reversed tick={{ fill: '#71717a', fontSize: 10 }} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color: '#34d399' }}
                      formatter={(v) => [`#${v}`, 'Posición']}
                    />
                    <ReferenceLine y={10} stroke="#3f3f46" strokeDasharray="4 2" label={{ value: 'Top 10', fill: '#52525b', fontSize: 10 }} />
                    <Line type="monotone" dataKey="pos" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )
      })()}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center text-center">
          <TrendingUp className="w-10 h-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium mb-1">
            {keywords.length === 0 ? 'Sin keywords todavía' : 'Sin resultados'}
          </p>
          <p className="text-zinc-600 text-sm">
            {keywords.length === 0 ? 'Sincronizá GSC para ver tus rankings.' : `No hay keywords con "${search}"`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {/* Collapsible header */}
          <button
            onClick={() => setTableOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
            <span className="text-xs text-zinc-500">
              {tableOpen ? 'Hacé clic en una keyword para ver su evolución de posición' : `${filtered.length} keywords — clic para expandir`}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              {tableOpen
                ? <><ChevronUp className="w-3.5 h-3.5" /> Contraer</>
                : <><ChevronDown className="w-3.5 h-3.5" /> Expandir</>
              }
            </span>
          </button>

          {tableOpen && (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Keyword</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500">Pos.</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500">Clics</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500">Impr.</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500">CTR</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell">País</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map(k => (
                    <tr key={k.id}
                      onClick={() => setSelectedKw(prev => prev === k.keyword ? null : k.keyword)}
                      className={cn(
                        'border-b border-zinc-800/50 last:border-0 cursor-pointer transition-colors',
                        selectedKw === k.keyword ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : 'hover:bg-zinc-800/30',
                      )}>
                      <td className="px-4 py-2.5 text-zinc-300 font-medium max-w-xs truncate">{k.keyword}</td>
                      <td className="px-3 py-2.5 text-center"><PosBadge pos={k.position} /></td>
                      <td className="px-3 py-2.5 text-center text-zinc-400 tabular-nums">{k.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-center text-zinc-400 tabular-nums">{k.impressions.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-center text-zinc-400 tabular-nums">{pct(k.ctr ?? 0)}</td>
                      <td className="px-3 py-2.5 text-center text-zinc-500 text-xs hidden sm:table-cell uppercase">{k.country ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <div className="px-4 py-2.5 text-xs text-zinc-600 border-t border-zinc-800">
                  Mostrando 200 de {filtered.length} keywords. Usa el export CSV para ver todas.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Google Trends — siempre visible debajo, independiente de GSC */}
      <GoogleTrendsSection hotelId={id} />
    </div>
  )
}
