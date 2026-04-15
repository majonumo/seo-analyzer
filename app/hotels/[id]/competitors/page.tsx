'use client'
// app/hotels/[id]/competitors/page.tsx — gestión de competidores OTA

import { use, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Globe, ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
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

function AddCompetitorModal({
  hotelId, onClose, onAdded,
}: { hotelId: string; onClose: () => void; onAdded: (c: Competitor) => void }) {
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
      onAdded(json)
      onClose()
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
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CompetitorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [hotel, setHotel]               = useState<HotelInfo | null>(null)
  const [competitors, setCompetitors]   = useState<Competitor[]>([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [deleting, setDeleting]         = useState<string | null>(null)

  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const [hr, cr] = await Promise.all([fetch(`/api/hotels/${id}`), fetch(`/api/hotels/${id}/competitors`)])
    if (hr.ok) { const h = await hr.json(); setHotel({ name: h.name, url: h.url, country: h.country }) }
    if (cr.ok) setCompetitors(await cr.json())
    setLoading(false)
  }

  async function handleDelete(competitorId: string) {
    if (!confirm('¿Eliminar este competidor?')) return
    setDeleting(competitorId)
    await fetch(`/api/hotels/${id}/competitors/${competitorId}`, { method: 'DELETE' })
    setCompetitors(prev => prev.filter(c => c.id !== competitorId))
    setDeleting(null)
  }

  return (
    <div className="max-w-5xl mx-auto">
      {hotel && <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Competidores</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Booking.com, Expedia y sitios directos · Sin Airbnb</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>}

      {!loading && competitors.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center text-center">
          <Globe className="w-10 h-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium mb-1">Sin competidores todavía</p>
          <p className="text-zinc-600 text-sm mb-5">Agrega los hoteles competidores que querés monitorear en OTAs.</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Agregar primer competidor
          </button>
        </div>
      )}

      {!loading && competitors.length > 0 && (
        <div className="space-y-3">
          {competitors.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-200">{c.name}</span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', PLATFORM_COLORS[c.platform])}>
                    {PLATFORM_LABELS[c.platform]}
                  </span>
                </div>
                <a href={c.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 w-fit">
                  {c.url.replace(/^https?:\/\//, '').slice(0, 60)}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                {deleting === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddCompetitorModal
          hotelId={id}
          onClose={() => setShowModal(false)}
          onAdded={c => setCompetitors(prev => [c, ...prev])}
        />
      )}
    </div>
  )
}
