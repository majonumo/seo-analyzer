'use client'
// app/hotels/[id]/page.tsx — overview del hotel

import { useEffect, useState} from 'react'
import Link from 'next/link'
import {
  Loader2, AlertTriangle, BarChart3, Search,
  Play, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Hotel, Audit, Delta } from '@/lib/supabase'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'

interface HotelDetail extends Hotel { last_audit: Audit | null }

function ScoreGauge({ score }: { score: number | null }) {
  const s = score ?? 0
  const color = s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-red-400'
  const ring  = s >= 80 ? 'border-emerald-500/30 bg-emerald-500/5'
    : s >= 50 ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-red-500/30 bg-red-500/5'
  return (
    <div className={cn('flex flex-col items-center justify-center w-28 h-28 rounded-2xl border-2', ring)}>
      <span className={cn('text-4xl font-black', color)}>{score ?? '—'}</span>
      <span className="text-xs text-zinc-500 mt-1">SEO Score</span>
    </div>
  )
}

function DeltaIcon({ impact }: { impact: string | null }) {
  if (impact === 'positive') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
  if (impact === 'negative') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-zinc-500" />
}

export default function HotelDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [hotel, setHotel]     = useState<HotelDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [audits, setAudits]   = useState<Audit[]>([])
  const [deltas, setDeltas]   = useState<Delta[]>([])

  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const [hr, ar, dr] = await Promise.all([
      fetch(`/api/hotels/${id}`),
      fetch(`/api/hotels/${id}/audits`),
      fetch(`/api/hotels/${id}/deltas`),
    ])
    if (hr.ok) setHotel(await hr.json())
    if (ar.ok) setAudits(await ar.json())
    if (dr.ok) setDeltas(await dr.json())
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-zinc-500 animate-spin" /></div>
  if (!hotel)  return <div className="text-red-400 text-sm p-4">Hotel no encontrado</div>

  const last = hotel.last_audit

  return (
    <div className="max-w-5xl mx-auto">
      <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 mb-8">
        {/* Score */}
        <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-zinc-800 bg-zinc-900">
          <ScoreGauge score={last?.score ?? null} />
          {last?.completed_at && (
            <p className="text-xs text-zinc-600 text-center">
              {format(new Date(last.completed_at), "d MMM yyyy", { locale: es })}<br/>
              {last.pages_crawled} páginas
            </p>
          )}
          {!last && <p className="text-xs text-zinc-600">Sin auditorías</p>}
        </div>

        {/* Stats + Quick actions */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Críticos',   val: last?.issues_critical ?? 0, color: 'text-red-400' },
              { label: 'Altos',      val: last?.issues_high ?? 0,     color: 'text-amber-400' },
              { label: 'Páginas',    val: last?.pages_crawled ?? 0,   color: 'text-zinc-300' },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
                <p className={cn('text-2xl font-bold', color)}>{val}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { href: `/hotels/${id}/audit`,       icon: Search,   label: 'Auditoría SEO',    sub: 'Crawl completo',          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { href: `/hotels/${id}/keywords`,    icon: TrendingUp, label: 'Keywords',        sub: 'Rankings GSC',            color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
              { href: `/hotels/${id}/competitors`, icon: BarChart3,  label: 'Competidores',    sub: 'Precios OTA',             color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { href: `/hotels/${id}/research`,    icon: Search,    label: 'Investigación',    sub: 'Reportes de mercado',     color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
            ].map(({ href, icon: Icon, label, sub, color }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors group">
                <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0', color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">{label}</p>
                  <p className="text-xs text-zinc-500">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Deltas feed */}
      {deltas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">Últimos cambios detectados</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {deltas.slice(0, 10).map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <DeltaIcon impact={d.impact} />
                <span className="text-sm text-zinc-300 flex-1">{d.description}</span>
                {d.previous_value && d.current_value && (
                  <span className="text-xs text-zinc-600 flex-shrink-0">
                    {d.previous_value} → {d.current_value}
                  </span>
                )}
                <span className="text-xs text-zinc-600 flex-shrink-0">
                  {format(new Date(d.created_at), "d MMM", { locale: es })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit history */}
      {audits.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">Historial de auditorías</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Fecha','Score','Páginas','Críticos','Altos','Estado'].map(h => (
                    <th key={h} className={cn('py-2.5 px-4 text-xs font-medium text-zinc-500', h === 'Fecha' ? 'text-left' : 'text-center')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map((a, i) => (
                  <tr key={a.id} className={cn('border-b border-zinc-800/50 last:border-0', i === 0 && 'bg-zinc-800/30')}>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {a.completed_at ? format(new Date(a.completed_at), "d MMM yyyy, HH:mm", { locale: es }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.score != null
                        ? <span className={cn('font-bold', a.score >= 80 ? 'text-emerald-400' : a.score >= 50 ? 'text-amber-400' : 'text-red-400')}>{a.score}</span>
                        : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-400">{a.pages_crawled}</td>
                    <td className="px-4 py-3 text-center"><span className={cn('font-semibold', a.issues_critical > 0 ? 'text-red-400' : 'text-zinc-600')}>{a.issues_critical}</span></td>
                    <td className="px-4 py-3 text-center"><span className={cn('font-semibold', a.issues_high > 0 ? 'text-amber-400' : 'text-zinc-600')}>{a.issues_high}</span></td>
                    <td className="px-4 py-3 text-center">
                      {a.status === 'completed'
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" /> OK</span>
                        : a.status === 'running'
                        ? <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Loader2 className="w-3 h-3 animate-spin" /> Corriendo</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Clock className="w-3 h-3" /> {a.status}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
