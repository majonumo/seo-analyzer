'use client'
// app/hotels/page.tsx — overview + lista de hoteles

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Plus, Loader2, Globe, Trash2,
  AlertTriangle, ChevronRight, Search,
  TrendingUp, TrendingDown, Minus, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Hotel, Audit } from '@/lib/supabase'

interface HotelWithAudit extends Hotel {
  last_audit: Pick<Audit, 'id' | 'score' | 'pages_crawled' | 'issues_critical' | 'issues_high' | 'completed_at' | 'status'> | null
}

interface Stats {
  hotelsActive:    number
  auditsThisMonth: number
  criticalIssues:  number
  recentDeltas:    { id: string; description: string; impact: string | null; created_at: string; hotels: { name: string; country: string } | null }[]
}

const COUNTRY_FLAGS: Record<string, string> = { mx: '🇲🇽', us: '🇺🇸', fr: '🇫🇷' }

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

function DeltaIcon({ impact }: { impact: string | null }) {
  if (impact === 'positive') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
  if (impact === 'negative') return <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
  return <Minus className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
}

export default function HotelsPage() {
  const [hotels, setHotels]     = useState<HotelWithAudit[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch]     = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const [hotelsRes, statsRes] = await Promise.all([
      fetch('/api/hotels'),
      fetch('/api/hotels/stats'),
    ])

    if (statsRes.ok) setStats(await statsRes.json())

    if (hotelsRes.ok) {
      const hotelList: Hotel[] = await hotelsRes.json()
      // Enrich with last audit in parallel
      const withAudits = await Promise.all(
        hotelList.map(async h => {
          const r = await fetch(`/api/hotels/${h.id}`)
          return r.ok ? await r.json() : { ...h, last_audit: null }
        })
      )
      setHotels(withAudits)
    }
    setLoading(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"? Se borrarán todas sus auditorías e issues.`)) return
    setDeleting(id)
    await fetch(`/api/hotels/${id}`, { method: 'DELETE' })
    setHotels(prev => prev.filter(h => h.id !== id))
    setDeleting(null)
  }

  const filtered = hotels.filter(h =>
    !search || h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.destination.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Hotel Intelligence Platform</p>
        </div>
        <Link href="/hotels/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Nuevo hotel
        </Link>
      </div>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-7">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <p className="text-3xl font-black text-zinc-100">{stats.hotelsActive}</p>
            <p className="text-xs text-zinc-500 mt-1">Hoteles activos</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <p className="text-3xl font-black text-zinc-100">{stats.auditsThisMonth}</p>
            <p className="text-xs text-zinc-500 mt-1">Auditorías este mes</p>
          </div>
          <div className={cn('rounded-xl border p-5 text-center',
            stats.criticalIssues > 0
              ? 'border-red-500/20 bg-red-500/5'
              : 'border-zinc-800 bg-zinc-900')}>
            <p className={cn('text-3xl font-black', stats.criticalIssues > 0 ? 'text-red-400' : 'text-zinc-100')}>
              {stats.criticalIssues}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Issues críticos pendientes</p>
          </div>
        </div>
      )}

      {/* Recent deltas */}
      {stats?.recentDeltas && stats.recentDeltas.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 mb-7 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Activity className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-400">Últimos cambios</span>
            <Link href="/reports" className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {stats.recentDeltas.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                <DeltaIcon impact={d.impact} />
                {d.hotels && (
                  <span className="text-xs text-zinc-600 flex-shrink-0">
                    {COUNTRY_FLAGS[d.hotels.country]} {d.hotels.name}
                  </span>
                )}
                <span className="text-sm text-zinc-400 flex-1 truncate">{d.description}</span>
                <span className="text-xs text-zinc-600 flex-shrink-0">
                  {format(new Date(d.created_at), "d MMM", { locale: es })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hotels section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-400">
          Hoteles <span className="text-zinc-600 font-normal">({hotels.length})</span>
        </h2>
        {hotels.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..." className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-44" />
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>}

      {!loading && hotels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-zinc-500" />
          </div>
          <p className="text-zinc-400 font-medium mb-1">Sin hoteles todavía</p>
          <p className="text-zinc-600 text-sm mb-6">Agregá tu primer hotel para empezar.</p>
          <Link href="/hotels/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Agregar hotel
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(hotel => (
            <div key={hotel.id} className="rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors group">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{COUNTRY_FLAGS[hotel.country]}</span>
                    <span className="text-sm font-semibold text-zinc-200 truncate">{hotel.name}</span>
                    <span className="hidden sm:inline text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">{hotel.destination}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-zinc-600" />
                    <a href={hotel.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-zinc-500 hover:text-zinc-300 truncate transition-colors" onClick={e => e.stopPropagation()}>
                      {hotel.url}
                    </a>
                  </div>
                </div>

                {hotel.last_audit && (
                  <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-center">
                    <div><p className="text-xs text-zinc-600 mb-1">Score</p><ScoreBadge score={hotel.last_audit.score} /></div>
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Críticos</p>
                      <span className={cn('text-sm font-semibold', hotel.last_audit.issues_critical > 0 ? 'text-red-400' : 'text-zinc-500')}>
                        {hotel.last_audit.issues_critical}
                      </span>
                    </div>
                  </div>
                )}

                {!hotel.last_audit && (
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-600 flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" /> Sin auditoría
                  </div>
                )}

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleDelete(hotel.id, hotel.name)} disabled={deleting === hotel.id}
                    className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    {deleting === hotel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

      {!loading && hotels.length > 0 && filtered.length === 0 && (
        <p className="text-center text-zinc-600 text-sm py-12">Sin resultados para "{search}"</p>
      )}
    </div>
  )
}
