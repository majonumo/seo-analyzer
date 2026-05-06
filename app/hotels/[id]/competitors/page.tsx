'use client'
// app/hotels/[id]/competitors/page.tsx — competidores OTA + auto-descubrimiento + historial de precios

import { useEffect, useState } from 'react'
import {
  Loader2, Plus, Trash2, Globe, ExternalLink, X,
  DollarSign, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Sparkles, RefreshCw, CheckCircle2, AlertCircle, Info,
  Search, AlertTriangle, ShieldCheck, Calendar,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Competitor, Platform } from '@/lib/supabase'

const PLATFORM_LABELS: Record<Platform, string> = {
  booking: 'Booking.com', expedia: 'Expedia', direct: 'Sitio directo', other: 'Otro',
}
const PLATFORM_COLORS: Record<Platform, string> = {
  booking: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  expedia: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  direct:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  other:   'text-zinc-400 bg-zinc-800 border-zinc-700',
}

interface HotelInfo { name: string; url: string; country: string; destination?: string }
interface CompetitorPrice {
  id: string; price_usd: number; price_local: number | null; currency: string
  room_type: string | null; check_in: string | null; scraped_at: string
}
interface CompetitorWithPrices extends Competitor { prices: CompetitorPrice[] }

interface GoogleHotelsResult {
  hotel_name:    string
  check_in:      string
  check_out:     string
  platforms:     { source: string; price_usd: number; sponsored: boolean; room_type: string | null }[]
  min_price:     number
  max_price:     number
  min_platform:  string
  max_platform:  string
  disparity_pct: number
  has_disparity: boolean
  saved:         number
  scanned_at?:   string   // solo en resultados cargados desde DB
}

interface DiscoverResult {
  discovered: number; saved: number; skipped: number; prices_saved?: number
  all_discovered: {
    name: string; website_url: string; booking_url: string | null
    platform: string; reason: string
    avg_price_usd: number | null; price_notes: string | null
  }[]
}

interface SyncResult {
  total: number; found: number; not_found: number
  results: { competitor_name: string; price_usd: number | null; method: string; error?: string }[]
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AddCompetitorModal({ hotelId, onClose, onAdded }: {
  hotelId: string; onClose: () => void; onAdded: (c: Competitor) => void
}) {
  const [form, setForm]     = useState({ name: '', url: '', platform: 'booking' as Platform })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/hotels/${hotelId}/competitors`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      onAdded(json); onClose()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Agregar competidor manual</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nombre *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
              placeholder="Hotel Rival" className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">URL *</label>
            <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} required type="url"
              placeholder="https://www.booking.com/hotel/..." className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Plataforma *</label>
            <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value as Platform }))}
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500">
              {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddPriceModal({ competitor, hotelId, onClose, onAdded }: {
  competitor: Competitor; hotelId: string; onClose: () => void; onAdded: (p: CompetitorPrice) => void
}) {
  const [form, setForm] = useState({ price_usd: '', room_type: '', check_in: '', platform: competitor.platform })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(form.price_usd)
    if (isNaN(price) || price <= 0) { setError('Precio inválido'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/hotels/${hotelId}/competitors/${competitor.id}/prices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_usd: price, room_type: form.room_type || null, check_in: form.check_in || null, platform: form.platform }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      onAdded(json); onClose()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-100">Registrar precio</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">{competitor.name} · {PLATFORM_LABELS[competitor.platform]}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Precio por noche (USD) *</label>
            <input value={form.price_usd} onChange={e => setForm(p => ({ ...p, price_usd: e.target.value }))} required
              type="number" min="0" step="0.01" placeholder="150.00"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tipo de habitación</label>
            <input value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))}
              placeholder="Doble estándar"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Fecha check-in</label>
            <input value={form.check_in} onChange={e => setForm(p => ({ ...p, check_in: e.target.value }))} type="date"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500" />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />} Guardar
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Google Hotels Scanner ────────────────────────────────────────────────────

function GoogleHotelsScanner({ hotelId, hotelName, hotelDestination }: {
  hotelId: string; hotelName: string; hotelDestination?: string
}) {
  const defaultQuery = `${hotelName}${hotelDestination ? ' ' + hotelDestination : ''}`
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState(defaultQuery)
  const [checkIn, setCheckIn]   = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [loading, setLoading]   = useState(false)
  const [loadingPrev, setLoadingPrev] = useState(true)
  const [result, setResult]     = useState<GoogleHotelsResult | null>(null)
  const [error, setError]       = useState('')
  const [hint, setHint]         = useState('')

  // Al montar: cargar el último scan guardado en la base de datos
  useEffect(() => {
    const fmt = (dt: Date) => dt.toISOString().split('T')[0]
    const t = new Date(); t.setDate(t.getDate() + 1)
    const d = new Date(); d.setDate(d.getDate() + 2)
    setCheckIn(fmt(t)); setCheckOut(fmt(d))

    fetch(`/api/hotels/${hotelId}/competitors/google-hotels`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setResult(data); setOpen(true) }
      })
      .catch(() => {})
      .finally(() => setLoadingPrev(false))
  }, [hotelId])

  async function handleSearch() {
    setLoading(true); setResult(null); setError(''); setHint('')
    try {
      const res = await fetch(`/api/hotels/${hotelId}/competitors/google-hotels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, check_in: checkIn, check_out: checkOut }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? `HTTP ${res.status}`)
        setHint(json?.hint ?? '')
        return
      }
      setResult(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const dispColor = result
    ? result.has_disparity
      ? 'text-red-400 bg-red-500/10 border-red-500/20'
      : result.disparity_pct > 5
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : ''

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden mb-5">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <Search className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-200">Google Hotels Scanner</p>
          <p className="text-xs text-zinc-500">
            {loadingPrev
              ? 'Cargando último scan…'
              : result?.scanned_at
                ? `Último scan: ${format(new Date(result.scanned_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}`
                : 'Detecta disparidad de precios entre OTAs en tiempo real'
            }
          </p>
        </div>
        <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-medium flex-shrink-0">
          Powered by SerpAPI
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800 p-5 space-y-4">
          {/* Search form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Hotel a buscar</label>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Hotel Thompson Playa del Carmen"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Check-in
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={e => setCheckIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Check-out
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={e => setCheckOut(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !query}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Buscando en Google Hotels...' : 'Buscar precios'}
          </button>

          {/* Error */}
          {error && (
            <div className="text-sm bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-1.5">
              <div className="flex items-start gap-2 text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {hint && (
                <p className="text-xs text-zinc-500 pl-6">{hint}</p>
              )}
              <div className="text-xs text-zinc-600 pl-6 space-y-0.5">
                <p>Tips de búsqueda:</p>
                <p>· Incluí la ciudad: <span className="text-zinc-400">"Hotel Mahekal Playa del Carmen"</span></p>
                <p>· Usá el nombre exacto como aparece en Booking.com o Google</p>
                <p>· Probá en inglés si el hotel tiene nombre en inglés</p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Hotel name + dates */}
              <div className="flex items-center gap-3 flex-wrap">
                {result.hotel_name && <p className="text-sm font-semibold text-zinc-200">{result.hotel_name}</p>}
                {result.check_in && <span className="text-xs text-zinc-500">{result.check_in}{result.check_out ? ` → ${result.check_out}` : ''}</span>}
                <span className="text-xs text-zinc-600">· {result.saved} precios guardados</span>
                {result.scanned_at && (
                  <span className="text-xs text-zinc-700">
                    · {format(new Date(result.scanned_at), "d MMM yyyy HH:mm", { locale: es })}
                  </span>
                )}
              </div>

              {/* Disparity badge */}
              <div className={cn('flex items-center gap-3 p-3 rounded-lg border', dispColor)}>
                {result.has_disparity
                  ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  : <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {result.has_disparity
                      ? `Disparidad de precios: ${result.disparity_pct}%`
                      : result.disparity_pct > 5
                        ? `Variación leve: ${result.disparity_pct}%`
                        : `Paridad correcta: ${result.disparity_pct}% variación`
                    }
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    Mínimo: <strong>${result.min_price}</strong> ({result.min_platform}) ·
                    Máximo: <strong>${result.max_price}</strong> ({result.max_platform})
                  </p>
                </div>
                <span className="text-2xl font-black flex-shrink-0">{result.disparity_pct}%</span>
              </div>

              {/* Price table */}
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800/50">
                    <tr className="text-xs text-zinc-500">
                      <th className="text-left px-4 py-2.5 font-medium">Plataforma</th>
                      <th className="text-right px-4 py-2.5 font-medium">Precio/noche</th>
                      <th className="text-right px-4 py-2.5 font-medium">vs. mínimo</th>
                      <th className="text-center px-4 py-2.5 font-medium">Patrocinado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {result.platforms
                      .sort((a, b) => a.price_usd - b.price_usd)
                      .map((p, i) => {
                        const diff    = ((p.price_usd - result.min_price) / result.min_price) * 100
                        const isMin   = p.price_usd === result.min_price
                        const isMax   = p.price_usd === result.max_price && result.platforms.length > 1
                        return (
                          <tr key={i} className={cn('', isMin ? 'bg-emerald-500/5' : isMax && result.has_disparity ? 'bg-red-500/5' : '')}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={cn('font-medium', isMin ? 'text-emerald-300' : isMax && result.has_disparity ? 'text-red-300' : 'text-zinc-200')}>
                                  {p.source}
                                </span>
                                {isMin && <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">más barato</span>}
                                {isMax && result.has_disparity && <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">más caro</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-zinc-100">${p.price_usd}</span>
                              <span className="text-zinc-500 text-xs ml-1">USD</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {diff === 0
                                ? <span className="text-zinc-600 text-xs">—</span>
                                : <span className={cn('text-xs font-medium', diff > 15 ? 'text-red-400' : diff > 5 ? 'text-amber-400' : 'text-zinc-400')}>
                                    +{diff.toFixed(1)}%
                                  </span>
                              }
                            </td>
                            <td className="px-4 py-3 text-center">
                              {p.sponsored
                                ? <span className="text-xs text-amber-400">Sí</span>
                                : <span className="text-xs text-zinc-700">—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>

              {result.has_disparity && (
                <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">Riesgo de rate parity</p>
                    <p className="text-amber-400/70">
                      Una diferencia de {result.disparity_pct}% entre OTAs puede afectar la estrategia de direct booking.
                      Revisá tu contrato de paridad de precios con {result.max_platform}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Discover result panel ────────────────────────────────────────────────────

function DiscoverPanel({ result, onClose }: { result: DiscoverResult; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-300 mb-1">
            Gemini encontró {result.discovered} competidores · {result.saved} nuevos guardados
            {result.skipped > 0 && ` · ${result.skipped} ya existían`}
          </p>
          <div className="space-y-2 mt-3">
            {result.all_discovered.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs">
                <span className={cn('px-1.5 py-0.5 rounded text-xs border flex-shrink-0 mt-0.5',
                  c.platform === 'booking' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                  'text-zinc-400 bg-zinc-800 border-zinc-700')}>
                  {c.platform === 'booking' ? 'Booking' : c.platform === 'direct' ? 'Directo' : c.platform}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-zinc-200 font-medium">{c.name}</span>
                  <span className="text-zinc-500 ml-2">{c.reason}</span>
                  {c.price_notes && (
                    <p className="text-zinc-600 mt-0.5">{c.price_notes}</p>
                  )}
                </div>
                {c.avg_price_usd && (
                  <span className="text-emerald-400 font-semibold flex-shrink-0 text-xs">
                    ~${c.avg_price_usd} USD
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-3 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Precios estimados por IA — temporada media. Usá "Sync precios" o "Precio" para datos en tiempo real.
          </p>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Sync result panel ────────────────────────────────────────────────────────

function SyncPanel({ result, onClose }: { result: SyncResult; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 mb-4">
      <div className="flex items-start gap-3">
        <RefreshCw className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-200 mb-1">
            Sync completado · {result.found}/{result.total} precios encontrados
          </p>
          <div className="space-y-1.5 mt-2">
            {result.results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {r.price_usd !== null
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                }
                <span className="text-zinc-400">{r.competitor_name}</span>
                {r.price_usd !== null
                  ? <span className="text-emerald-400 font-medium">${r.price_usd} USD</span>
                  : <span className="text-zinc-600">{r.error ?? 'No encontrado'}</span>
                }
                {r.price_usd !== null && (
                  <span className="text-zinc-700">vía {r.method}</span>
                )}
              </div>
            ))}
          </div>
          {result.not_found > 0 && (
            <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Los precios no encontrados son de sitios con protección anti-bot. Usa el botón "Precio" para ingresar manualmente.
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Competitor card ──────────────────────────────────────────────────────────

function CompetitorCard({ competitor, hotelId, myLatestPrice, onDelete, onPriceAdded }: {
  competitor: CompetitorWithPrices
  hotelId: string
  myLatestPrice: number | null
  onDelete: (id: string) => void
  onPriceAdded: (competitorId: string, price: CompetitorPrice) => void
}) {
  const [expanded, setExpanded]             = useState(false)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [deleting, setDeleting]             = useState(false)

  const latestPrice = competitor.prices[0]?.price_usd ?? null
  const priceDiff   = myLatestPrice && latestPrice
    ? ((latestPrice - myLatestPrice) / myLatestPrice) * 100
    : null

  const chartData = [...competitor.prices].reverse().slice(-10).map(p => ({
    date:   format(new Date(p.scraped_at), 'd MMM', { locale: es }),
    precio: p.price_usd,
  }))

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${competitor.name}"?`)) return
    setDeleting(true)
    await fetch(`/api/hotels/${hotelId}/competitors/${competitor.id}`, { method: 'DELETE' })
    onDelete(competitor.id)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-zinc-200">{competitor.name}</span>
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', PLATFORM_COLORS[competitor.platform])}>
              {PLATFORM_LABELS[competitor.platform]}
            </span>
          </div>
          <a href={competitor.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 w-fit">
            {competitor.url.replace(/^https?:\/\//, '').slice(0, 55)}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Price summary */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {latestPrice !== null ? (
            <div className="text-right">
              <p className="text-base font-bold text-zinc-100">
                ${latestPrice.toFixed(0)} <span className="text-xs text-zinc-500 font-normal">USD</span>
              </p>
              {priceDiff !== null && (
                <div className={cn('flex items-center justify-end gap-0.5 text-xs font-medium',
                  priceDiff > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {priceDiff > 0
                    ? <><TrendingUp className="w-3 h-3" />+{priceDiff.toFixed(1)}% vs nosotros</>
                    : <><TrendingDown className="w-3 h-3" />{priceDiff.toFixed(1)}% vs nosotros</>
                  }
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-zinc-600">Sin precio</span>
          )}

          <button onClick={() => setShowPriceModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
            <DollarSign className="w-3.5 h-3.5" /> Precio
          </button>

          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button onClick={handleDelete} disabled={deleting}
            className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-4">
          {competitor.prices.length === 0 ? (
            <p className="text-xs text-zinc-600 py-4 text-center">
              Sin historial de precios. Usá "Sync precios" o hacé clic en "Precio" para registrar manualmente.
            </p>
          ) : (
            <div className="space-y-4">
              {chartData.length >= 2 && (
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color: '#60a5fa' }}
                        formatter={(v) => [`$${v}`, 'Precio USD']}
                      />
                      <Line type="monotone" dataKey="precio" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left pb-2 font-medium">Fecha</th>
                      <th className="text-left pb-2 font-medium">Habitación</th>
                      <th className="text-right pb-2 font-medium">USD</th>
                      {myLatestPrice && <th className="text-right pb-2 font-medium">vs Nosotros</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {competitor.prices.slice(0, 10).map(p => {
                      const diff = myLatestPrice ? ((p.price_usd - myLatestPrice) / myLatestPrice) * 100 : null
                      return (
                        <tr key={p.id} className="text-zinc-400">
                          <td className="py-2">{format(new Date(p.scraped_at), 'd MMM yyyy', { locale: es })}</td>
                          <td className="py-2 text-zinc-500">{p.room_type ?? '—'}</td>
                          <td className="py-2 text-right font-medium text-zinc-200">${p.price_usd.toFixed(2)}</td>
                          {myLatestPrice && diff !== null && (
                            <td className={cn('py-2 text-right font-medium', diff > 0 ? 'text-emerald-400' : 'text-red-400')}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showPriceModal && (
        <AddPriceModal
          competitor={competitor}
          hotelId={hotelId}
          onClose={() => setShowPriceModal(false)}
          onAdded={p => onPriceAdded(competitor.id, p)}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorsPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [hotel, setHotel]                   = useState<HotelInfo | null>(null)
  const [competitors, setCompetitors]       = useState<CompetitorWithPrices[]>([])
  const [loading, setLoading]               = useState(true)
  const [showModal, setShowModal]           = useState(false)
  const [myPrice, setMyPrice]               = useState<number | null>(null)

  // Auto-discover state
  const [discovering, setDiscovering]       = useState(false)
  const [discoverResult, setDiscoverResult] = useState<DiscoverResult | null>(null)
  const [discoverError, setDiscoverError]   = useState('')

  // Sync prices state
  const [syncing, setSyncing]               = useState(false)
  const [syncResult, setSyncResult]         = useState<SyncResult | null>(null)
  const [syncError, setSyncError]           = useState('')

  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const [hr, cr] = await Promise.all([fetch(`/api/hotels/${id}`), fetch(`/api/hotels/${id}/competitors`)])
    if (hr.ok) { const h = await hr.json(); setHotel({ name: h.name, url: h.url, country: h.country, destination: h.destination }) }
    if (cr.ok) {
      const list: Competitor[] = await cr.json()
      const enriched = await Promise.all(list.map(async c => {
        const pr = await fetch(`/api/hotels/${id}/competitors/${c.id}/prices`)
        const prices: CompetitorPrice[] = pr.ok ? await pr.json() : []
        return { ...c, prices }
      }))
      setCompetitors(enriched)
    }
    setLoading(false)
  }

  async function handleDiscover() {
    setDiscovering(true); setDiscoverResult(null); setDiscoverError('')
    try {
      const res = await fetch(`/api/hotels/${id}/competitors/discover`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      setDiscoverResult(json)
      // Recargar competidores si se guardaron nuevos
      if (json.saved > 0) await init()
    } catch (e) {
      setDiscoverError((e as Error).message)
    } finally {
      setDiscovering(false)
    }
  }

  async function handleSyncPrices() {
    setSyncing(true); setSyncResult(null); setSyncError('')
    try {
      const res = await fetch(`/api/hotels/${id}/competitors/sync-prices`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      setSyncResult(json)
      // Recargar para mostrar precios actualizados
      if (json.found > 0) await init()
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  function handlePriceAdded(competitorId: string, price: CompetitorPrice) {
    setCompetitors(prev => prev.map(c =>
      c.id === competitorId ? { ...c, prices: [price, ...c.prices] } : c
    ))
  }

  return (
    <div className="max-w-5xl mx-auto">
      {hotel && <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Competidores</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Booking.com, Expedia y sitios directos · Sin Airbnb</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync precios */}
          <button
            onClick={handleSyncPrices}
            disabled={syncing || competitors.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm font-medium transition-colors border border-zinc-700">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Sincronizando...' : 'Sync precios'}
          </button>

          {/* Auto-descubrir con IA */}
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
            {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {discovering ? 'Analizando con IA...' : 'Auto-descubrir'}
          </button>

          {/* Manual */}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      {/* Paneles de resultado */}
      {discoverError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 mb-4 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {discoverError}
        </div>
      )}
      {discoverResult && (
        <DiscoverPanel result={discoverResult} onClose={() => setDiscoverResult(null)} />
      )}

      {syncError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 mb-4 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {syncError}
        </div>
      )}
      {syncResult && (
        <SyncPanel result={syncResult} onClose={() => setSyncResult(null)} />
      )}

      {/* Google Hotels Scanner */}
      {hotel && <GoogleHotelsScanner hotelId={id} hotelName={hotel.name} hotelDestination={hotel.destination} />}

      {/* Mi precio base */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-5 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium text-zinc-400 mb-0.5">Mi precio base (USD/noche)</p>
          <p className="text-xs text-zinc-600">Usado para calcular el % de diferencia vs competidores</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm">$</span>
          <input type="number" min="0" step="0.01" value={myPrice ?? ''}
            onChange={e => setMyPrice(parseFloat(e.target.value) || null)}
            placeholder="150"
            className="w-24 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-right" />
          <span className="text-zinc-500 text-xs">USD</span>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>}

      {!loading && competitors.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center text-center">
          <Sparkles className="w-10 h-10 text-violet-500/50 mb-4" />
          <p className="text-zinc-400 font-medium mb-1">Sin competidores todavía</p>
          <p className="text-zinc-600 text-sm mb-5 max-w-sm">
            Usá <strong className="text-violet-400">Auto-descubrir</strong> para que Gemini identifique automáticamente los 5 hoteles competidores más relevantes, o agregá uno manualmente.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={handleDiscover} disabled={discovering}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {discovering ? 'Analizando...' : 'Auto-descubrir con IA'}
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">
              <Plus className="w-4 h-4" /> Agregar manual
            </button>
          </div>
        </div>
      )}

      {!loading && competitors.length > 0 && (
        <div className="space-y-3">
          {competitors.map(c => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              hotelId={id}
              myLatestPrice={myPrice}
              onDelete={cid => setCompetitors(prev => prev.filter(x => x.id !== cid))}
              onPriceAdded={handlePriceAdded}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddCompetitorModal
          hotelId={id}
          onClose={() => setShowModal(false)}
          onAdded={c => setCompetitors(prev => [{ ...c, prices: [] }, ...prev])}
        />
      )}
    </div>
  )
}
