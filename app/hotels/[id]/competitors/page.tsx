'use client'
// app/hotels/[id]/competitors/page.tsx — competidores OTA + historial de precios

import { use, useEffect, useState } from 'react'
import {
  Loader2, Plus, Trash2, Globe, ExternalLink, X,
  DollarSign, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
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

interface HotelInfo { name: string; url: string; country: string }
interface CompetitorPrice {
  id: string; price_usd: number; price_local: number | null; currency: string
  room_type: string | null; check_in: string | null; scraped_at: string
}
interface CompetitorWithPrices extends Competitor { prices: CompetitorPrice[] }

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
          <h2 className="text-base font-semibold text-zinc-100">Agregar competidor</h2>
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

// ─── Competitor card ──────────────────────────────────────────────────────────

function CompetitorCard({ competitor, hotelId, myLatestPrice, onDelete, onPriceAdded }: {
  competitor: CompetitorWithPrices
  hotelId: string
  myLatestPrice: number | null
  onDelete: (id: string) => void
  onPriceAdded: (competitorId: string, price: CompetitorPrice) => void
}) {
  const [expanded, setExpanded]         = useState(false)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [deleting, setDeleting]         = useState(false)

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
              Sin historial de precios. Hacé clic en "Precio" para registrar el primer dato.
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

export default function CompetitorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [hotel, setHotel]             = useState<HotelInfo | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorWithPrices[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [myPrice, setMyPrice]         = useState<number | null>(null)

  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const [hr, cr] = await Promise.all([fetch(`/api/hotels/${id}`), fetch(`/api/hotels/${id}/competitors`)])
    if (hr.ok) { const h = await hr.json(); setHotel({ name: h.name, url: h.url, country: h.country }) }
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
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {/* Mi precio base */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-5 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium text-zinc-400 mb-0.5">Mi precio base (USD/noche)</p>
          <p className="text-xs text-zinc-600">Usado para el % de diferencia vs competidores</p>
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
          <Globe className="w-10 h-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium mb-1">Sin competidores todavía</p>
          <p className="text-zinc-600 text-sm mb-5">Agrega hoteles competidores para monitorear sus precios en OTAs.</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Agregar primer competidor
          </button>
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
