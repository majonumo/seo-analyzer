'use client'
// app/hotels/[id]/keywords/page.tsx — rankings GSC + quick wins

import { use, useEffect, useState } from 'react'
import {
  Loader2, RefreshCw, TrendingUp, AlertTriangle,
  Download, Search, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import type { Keyword } from '@/lib/supabase'

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

export default function KeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [hotel, setHotel]       = useState<HotelInfo | null>(null)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState('')
  const [tab, setTab]           = useState<KwTab>('all')
  const [days, setDays]         = useState<DayOpt>(90)
  const [search, setSearch]     = useState('')

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
                <tr key={k.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
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
        </div>
      )}
    </div>
  )
}
