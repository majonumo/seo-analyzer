'use client'
// app/hotels/[id]/research/page.tsx — reportes de investigación con markdown

import { use, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Loader2, Plus, Trash2, FileText, ChevronRight,
  ArrowLeft, X, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import type { ReportType, ResearchReport } from '@/lib/supabase'

interface HotelInfo { name: string; url: string; country: string }
type ListItem = { id: string; type: ReportType; title: string; destination: string | null; created_at: string }

const TYPE_LABELS: Record<ReportType, string> = {
  market_analysis:   'Análisis de mercado',
  competitor_intel:  'Inteligencia competitiva',
  ota_strategy:      'Estrategia OTA',
  due_diligence:     'Due diligence',
  content_strategy:  'Estrategia de contenido',
  monthly_news:      'News mensuales',
}
const TYPE_COLORS: Record<ReportType, string> = {
  market_analysis:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  competitor_intel:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ota_strategy:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  due_diligence:     'text-violet-400 bg-violet-500/10 border-violet-500/20',
  content_strategy:  'text-pink-400 bg-pink-500/10 border-pink-500/20',
  monthly_news:      'text-zinc-400 bg-zinc-800 border-zinc-700',
}

const PROMPT_TEMPLATES: Record<ReportType, string> = {
  market_analysis:  '## Análisis de Mercado\n\n### Destino\n[Nombre del destino]\n\n### Resumen ejecutivo\n[Tu análisis aquí]\n\n### Tendencias clave\n- \n- \n\n### Oportunidades\n- \n\n### Riesgos\n- \n',
  competitor_intel: '## Inteligencia Competitiva\n\n### Competidores analizados\n- \n\n### Comparativa de precios\n| Hotel | Precio base | OTA principal |\n|-------|------------|---------------|\n| | | |\n\n### Estrategias detectadas\n- \n\n### Conclusiones\n',
  ota_strategy:     '## Estrategia Anti-OTA\n\n### Situación actual\n[Dependencia actual de OTAs]\n\n### Estrategia de direct booking\n- \n\n### Acciones recomendadas\n1. \n2. \n\n### KPIs objetivo\n- \n',
  due_diligence:    '## Due Diligence\n\n### Propiedad analizada\n[Dirección / URL]\n\n### Mercado\n\n### Regulaciones\n\n### Proyección financiera\n\n### Recomendación\n',
  content_strategy: '## Estrategia de Contenido\n\n### Objetivo\n\n### Keywords objetivo\n- \n\n### Pilares de contenido\n1. \n\n### Calendario editorial\n| Mes | Tema | Formato |\n|-----|------|---------|\n| | | |\n',
  monthly_news:     '## News Mensuales\n\n**Período:** [Mes Año]\n\n### Noticias del destino\n- \n\n### Movimientos de competidores\n- \n\n### Tendencias de mercado\n- \n\n### Acciones sugeridas\n- \n',
}

// ── New Report Form ────────────────────────────────────────────────────────────

function NewReportForm({ hotelId, onClose, onCreated }: {
  hotelId: string; onClose: () => void; onCreated: (r: ListItem) => void
}) {
  const [form, setForm] = useState({
    type: 'market_analysis' as ReportType, title: '', destination: '', content: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function loadTemplate(type: ReportType) {
    setForm(p => ({ ...p, type, content: PROMPT_TEMPLATES[type] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const res = await fetch(`/api/hotels/${hotelId}/research`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, title: form.title, content: form.content, destination: form.destination || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      onCreated(json); onClose()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 my-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Nuevo reporte</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tipo *</label>
              <select value={form.type}
                onChange={e => loadTemplate(e.target.value as ReportType)}
                className={inputCls}>
                {(Object.entries(TYPE_LABELS) as [ReportType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Destino</label>
              <input value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
                placeholder="Tulum, Miami, París..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Título *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              required placeholder="Análisis de mercado Q2 2026" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Contenido * <span className="text-zinc-600">(Markdown)</span></label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              required rows={12} placeholder="Escribe el reporte en Markdown..."
              className={cn(inputCls, 'resize-y font-mono text-xs leading-relaxed')} />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Guardar
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

// ── Report Viewer ─────────────────────────────────────────────────────────────

function ReportViewer({ hotelId, reportId, onClose, onDeleted }: {
  hotelId: string; reportId: string; onClose: () => void; onDeleted: (id: string) => void
}) {
  const [report, setReport]   = useState<ResearchReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/hotels/${hotelId}/research/${reportId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setReport(d); setLoading(false) })
  }, [hotelId, reportId])

  async function handleDelete() {
    if (!confirm('¿Eliminar este reporte?')) return
    setDeleting(true)
    await fetch(`/api/hotels/${hotelId}/research/${reportId}`, { method: 'DELETE' })
    onDeleted(reportId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 my-auto">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10 rounded-t-2xl">
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          {report && (
            <>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', TYPE_COLORS[report.type])}>
                {TYPE_LABELS[report.type]}
              </span>
              <h2 className="text-sm font-semibold text-zinc-100 flex-1 truncate">{report.title}</h2>
            </>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Eliminar
          </button>
        </div>

        <div className="px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
          ) : report ? (
            <article className="prose prose-invert prose-sm max-w-none prose-headings:text-zinc-200 prose-p:text-zinc-400 prose-strong:text-zinc-300 prose-li:text-zinc-400 prose-a:text-emerald-400 prose-code:text-zinc-300 prose-table:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
            </article>
          ) : (
            <p className="text-zinc-500 text-sm text-center py-12">Reporte no encontrado</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [hotel, setHotel]       = useState<HotelInfo | null>(null)
  const [reports, setReports]   = useState<ListItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewing, setViewing]   = useState<string | null>(null)

  useEffect(() => { init() }, [id])

  async function init() {
    setLoading(true)
    const [hr, rr] = await Promise.all([fetch(`/api/hotels/${id}`), fetch(`/api/hotels/${id}/research`)])
    if (hr.ok) { const h = await hr.json(); setHotel({ name: h.name, url: h.url, country: h.country }) }
    if (rr.ok) setReports(await rr.json())
    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto">
      {hotel && <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Investigación</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Reportes de mercado, competidores y estrategia · {reports.length} reportes</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Nuevo reporte
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>}

      {!loading && reports.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center text-center">
          <BookOpen className="w-10 h-10 text-zinc-600 mb-4" />
          <p className="text-zinc-400 font-medium mb-1">Sin reportes todavía</p>
          <p className="text-zinc-600 text-sm mb-5">Crea tu primer reporte de investigación. Soporta Markdown.</p>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Crear reporte
          </button>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map(r => (
            <button key={r.id} onClick={() => setViewing(r.id)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors text-left group">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', TYPE_COLORS[r.type])}>
                    {TYPE_LABELS[r.type]}
                  </span>
                  {r.destination && (
                    <span className="text-xs text-zinc-500">{r.destination}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100 truncate">{r.title}</p>
                <p className="text-xs text-zinc-600">
                  {format(new Date(r.created_at), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <NewReportForm
          hotelId={id}
          onClose={() => setShowForm(false)}
          onCreated={r => setReports(prev => [r, ...prev])}
        />
      )}

      {viewing && (
        <ReportViewer
          hotelId={id}
          reportId={viewing}
          onClose={() => setViewing(null)}
          onDeleted={delId => setReports(prev => prev.filter(r => r.id !== delId))}
        />
      )}
    </div>
  )
}
