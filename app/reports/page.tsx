'use client'
// app/reports/page.tsx — timeline global de deltas de todos los hoteles

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const FLAGS: Record<string, string> = { mx: '🇲🇽', us: '🇺🇸', fr: '🇫🇷' }

interface DeltaItem {
  id:             string
  type:           string
  description:    string
  previous_value: string | null
  current_value:  string | null
  impact:         'positive' | 'negative' | 'neutral' | null
  created_at:     string
  hotel_id:       string
  hotels:         { name: string; country: string } | null
}

type ImpactFilter = 'all' | 'positive' | 'negative' | 'neutral'

const IMPACT_LABELS: Record<ImpactFilter, string> = {
  all: 'Todos', positive: 'Mejoras', negative: 'Problemas', neutral: 'Neutros',
}

function DeltaIcon({ impact }: { impact: string | null }) {
  if (impact === 'positive') return <TrendingUp className="w-4 h-4 text-emerald-400" />
  if (impact === 'negative') return <TrendingDown className="w-4 h-4 text-red-400" />
  return <Minus className="w-4 h-4 text-zinc-500" />
}

function DeltaBg({ impact }: { impact: string | null }) {
  if (impact === 'positive') return 'border-emerald-500/20 bg-emerald-500/5'
  if (impact === 'negative') return 'border-red-500/20 bg-red-500/5'
  return 'border-zinc-800 bg-zinc-900'
}

export default function ReportsPage() {
  const [deltas, setDeltas]   = useState<DeltaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<ImpactFilter>('all')

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setDeltas(d); setLoading(false) })
  }, [])

  const filtered = deltas.filter(d => filter === 'all' || d.impact === filter)

  // Group by date
  const grouped = filtered.reduce<Record<string, DeltaItem[]>>((acc, d) => {
    const day = format(new Date(d.created_at), "EEEE d 'de' MMMM yyyy", { locale: es })
    acc[day] = acc[day] ?? []
    acc[day].push(d)
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Reportes globales</h1>
          <p className="text-sm text-zinc-500 mt-1">Cambios detectados en todos los hoteles</p>
        </div>

        {/* Impact filter */}
        <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
          {(Object.entries(IMPACT_LABELS) as [ImpactFilter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors',
                filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Filter className="w-10 h-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium mb-1">Sin cambios registrados</p>
          <p className="text-zinc-600 text-sm">Los deltas aparecen automáticamente al completar auditorías.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-8">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 capitalize">{day}</p>
              <div className="space-y-2">
                {items.map(d => (
                  <div key={d.id}
                    className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border', DeltaBg({ impact: d.impact }))}>
                    <DeltaIcon impact={d.impact} />

                    {/* Hotel badge */}
                    {d.hotels && (
                      <Link href={`/hotels/${d.hotel_id}`}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
                        <span>{FLAGS[d.hotels.country] ?? '🏨'}</span>
                        <span>{d.hotels.name}</span>
                      </Link>
                    )}

                    <span className="flex-1 text-sm text-zinc-300">{d.description}</span>

                    {d.previous_value && d.current_value && (
                      <span className="text-xs text-zinc-600 flex-shrink-0 tabular-nums">
                        {d.previous_value} → {d.current_value}
                      </span>
                    )}

                    <span className="text-xs text-zinc-600 flex-shrink-0">
                      {format(new Date(d.created_at), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
