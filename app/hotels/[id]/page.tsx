'use client'
// app/hotels/[id]/page.tsx — overview del hotel con tabs

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Globe, Loader2, Building2, AlertTriangle,
  BarChart3, Search, Play, CheckCircle2, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Hotel, Audit } from '@/lib/supabase'

interface HotelDetail extends Hotel {
  last_audit: Audit | null
}

const COUNTRY_FLAGS: Record<string, string> = { mx: '🇲🇽', us: '🇺🇸', fr: '🇫🇷' }

function ScoreGauge({ score }: { score: number | null }) {
  const s = score ?? 0
  const color = s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-red-400'
  const bg    = s >= 80 ? 'bg-emerald-500/10 border-emerald-500/20'
    : s >= 50 ? 'bg-amber-500/10 border-amber-500/20'
    : 'bg-red-500/10 border-red-500/20'
  return (
    <div className={cn('flex flex-col items-center justify-center w-28 h-28 rounded-2xl border', bg)}>
      <span className={cn('text-4xl font-black', color)}>{score ?? '—'}</span>
      <span className="text-xs text-zinc-500 mt-1">SEO Score</span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-center">
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const [hotel, setHotel]   = useState<HotelDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [audits, setAudits] = useState<Audit[]>([])

  useEffect(() => {
    loadHotel()
    loadAudits()
  }, [id])

  async function loadHotel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/hotels/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      setHotel(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadAudits() {
    const res = await fetch(`/api/hotels/${id}/audits`)
    if (res.ok) setAudits(await res.json())
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
    </div>
  )

  if (error) return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-400">{error}</div>
    </div>
  )

  if (!hotel) return null

  const last = hotel.last_audit
  const lastDate = last?.completed_at
    ? format(new Date(last.completed_at), "d MMM yyyy, HH:mm", { locale: es })
    : null

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <Link href="/hotels" className="text-zinc-500 hover:text-zinc-300 transition-colors mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{COUNTRY_FLAGS[hotel.country]}</span>
            <h1 className="text-2xl font-bold text-zinc-100 truncate">{hotel.name}</h1>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{hotel.destination}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-zinc-600" />
            <a href={hotel.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              {hotel.url}
            </a>
          </div>
        </div>
        <Link href={`/hotels/${id}/audit`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors flex-shrink-0">
          <Play className="w-3.5 h-3.5" /> Auditar
        </Link>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 mb-8">
        {/* Score */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-zinc-800 bg-zinc-900">
          <ScoreGauge score={last?.score ?? null} />
          {lastDate && (
            <p className="text-xs text-zinc-600 mt-3 text-center">Último audit<br/>{lastDate}</p>
          )}
          {!last && (
            <p className="text-xs text-zinc-600 mt-3 text-center">Sin auditorías</p>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Páginas crawleadas" value={last?.pages_crawled ?? 0} />
            <StatCard label="Issues críticos" value={last?.issues_critical ?? 0} />
            <StatCard label="Issues altos" value={last?.issues_high ?? 0} />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/hotels/${id}/audit`}
              className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Search className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">Auditoría SEO</p>
                <p className="text-xs text-zinc-500">Crawl completo del sitio</p>
              </div>
            </Link>
            <Link href={`/hotels/${id}/research`}
              className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100">Investigación</p>
                <p className="text-xs text-zinc-500">Reportes de mercado</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Audit history */}
      <div>
        <h2 className="text-base font-semibold text-zinc-200 mb-3">Historial de auditorías</h2>
        {audits.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <AlertTriangle className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Sin auditorías todavía</p>
            <Link href={`/hotels/${id}/audit`}
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              <Play className="w-3 h-3" /> Ejecutar primera auditoría
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Fecha</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500">Score</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500">Páginas</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500">Críticos</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-500">Altos</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a, i) => (
                  <tr key={a.id} className={cn('border-b border-zinc-800/50 last:border-0', i === 0 && 'bg-zinc-800/30')}>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {a.completed_at
                        ? format(new Date(a.completed_at), "d MMM yyyy, HH:mm", { locale: es })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.score !== null ? (
                        <span className={cn('text-sm font-bold',
                          a.score >= 80 ? 'text-emerald-400' : a.score >= 50 ? 'text-amber-400' : 'text-red-400')}>
                          {a.score}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-400">{a.pages_crawled}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-semibold', a.issues_critical > 0 ? 'text-red-400' : 'text-zinc-600')}>
                        {a.issues_critical}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-semibold', a.issues_high > 0 ? 'text-amber-400' : 'text-zinc-600')}>
                        {a.issues_high}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.status === 'completed'
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Completada</span>
                        : a.status === 'running'
                        ? <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Loader2 className="w-3 h-3 animate-spin" /> En progreso</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Clock className="w-3 h-3" /> {a.status}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
