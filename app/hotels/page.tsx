'use client'
// app/hotels/page.tsx — lista de hoteles

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Plus, Loader2, Globe, Flag, Trash2,
  AlertTriangle, CheckCircle2, ChevronRight, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Hotel, Audit } from '@/lib/supabase'

interface HotelWithAudit extends Hotel {
  last_audit: Pick<Audit, 'id' | 'score' | 'pages_crawled' | 'issues_critical' | 'issues_high' | 'issues_low' | 'completed_at' | 'status'> | null
}

const COUNTRY_FLAGS: Record<string, string> = { mx: '🇲🇽', us: '🇺🇸', fr: '🇫🇷' }
const COUNTRY_LABELS: Record<string, string> = { mx: 'México', us: 'USA', fr: 'Francia' }

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-zinc-600">—</span>
  const color = score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20'
  return (
    <span className={cn('inline-flex items-center justify-center rounded-md font-semibold border text-xs px-2 py-0.5 min-w-[2.5rem]', color)}>
      {score}
    </span>
  )
}

export default function HotelsPage() {
  const [hotels, setHotels]   = useState<HotelWithAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch]   = useState('')

  useEffect(() => { loadHotels() }, [])

  async function loadHotels() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/hotels')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      // Para cada hotel, cargar su último audit
      const withAudits = await Promise.all(
        (json as Hotel[]).map(async (h) => {
          const r = await fetch(`/api/hotels/${h.id}`)
          return r.ok ? await r.json() : { ...h, last_audit: null }
        })
      )
      setHotels(withAudits)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el hotel "${name}"? Se eliminarán todas sus auditorías e issues.`)) return
    setDeleting(id)
    try {
      await fetch(`/api/hotels/${id}`, { method: 'DELETE' })
      setHotels(prev => prev.filter(h => h.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const filtered = hotels.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.destination.toLowerCase().includes(search.toLowerCase()) ||
    h.url.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Hoteles</h1>
          <p className="text-sm text-zinc-500 mt-1">Propiedades gestionadas · {hotels.length} en total</p>
        </div>
        <Link href="/hotels/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Nuevo hotel
        </Link>
      </div>

      {/* Search */}
      {hotels.length > 0 && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, destino o URL..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-400">{error}</div>
      )}

      {/* Empty */}
      {!loading && !error && hotels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-zinc-500" />
          </div>
          <p className="text-zinc-400 font-medium mb-1">Sin hoteles todavía</p>
          <p className="text-zinc-600 text-sm mb-6">Agregá tu primer hotel para empezar a auditar.</p>
          <Link href="/hotels/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Agregar hotel
          </Link>
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(hotel => (
            <div key={hotel.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors group">
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Flag + name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{COUNTRY_FLAGS[hotel.country]}</span>
                    <span className="text-sm font-semibold text-zinc-200 truncate">{hotel.name}</span>
                    <span className="hidden sm:inline text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {hotel.destination}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    <a href={hotel.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-zinc-500 hover:text-zinc-300 truncate transition-colors"
                      onClick={e => e.stopPropagation()}>
                      {hotel.url}
                    </a>
                  </div>
                </div>

                {/* Audit stats */}
                {hotel.last_audit && (
                  <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-center">
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Score</p>
                      <ScoreBadge score={hotel.last_audit.score} />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Críticos</p>
                      <span className={cn('text-sm font-semibold', hotel.last_audit.issues_critical > 0 ? 'text-red-400' : 'text-zinc-500')}>
                        {hotel.last_audit.issues_critical}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Páginas</p>
                      <span className="text-sm font-semibold text-zinc-400">{hotel.last_audit.pages_crawled}</span>
                    </div>
                  </div>
                )}

                {!hotel.last_audit && !loading && (
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-600 flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" /> Sin auditoría
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDelete(hotel.id, hotel.name)}
                    disabled={deleting === hotel.id}
                    className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    {deleting === hotel.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                  <Link href={`/hotels/${hotel.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors">
                    Ver <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && hotels.length > 0 && filtered.length === 0 && (
        <p className="text-center text-zinc-600 text-sm py-12">Sin resultados para "{search}"</p>
      )}
    </div>
  )
}
