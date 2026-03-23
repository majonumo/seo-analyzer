'use client'
// app/projects/page.tsx — lista de proyectos guardados

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowLeft, Trash2, Loader2, FolderOpen, Globe, ChevronRight } from 'lucide-react'
import { getScoreColor, scoreColorClasses } from '@/lib/scoring'
import { cn } from '@/lib/utils'

interface ProjectSummary {
  id:           string
  created_at:   string
  domain:       string
  avg_score:    number
  avg_seo:      number
  avg_perf:     number
  total_pages:  number
  completed_at: string
  sitemap_url:  string | null
}

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColorClasses[getScoreColor(score)]
  return (
    <span className={cn('inline-flex items-center justify-center rounded-md font-semibold border text-xs px-2 py-0.5 min-w-[2.5rem]', c.text, c.bg, c.border)}>
      {score}
    </span>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError]       = useState('')

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Error al cargar proyectos')
      setProjects(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, domain: string) {
    if (!confirm(`¿Eliminar el proyecto de ${domain}?`)) return
    setDeleting(id)
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 sticky top-0 z-40 bg-zinc-950/90 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
            <Search className="w-4 h-4 text-zinc-950" />
          </div>
          <span className="font-semibold text-sm tracking-tight">SEO Analyzer — Proyectos</span>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Proyectos guardados</h1>
            <p className="text-sm text-zinc-500 mt-1">Auditorías previas · Click para volver a verlas</p>
          </div>
          <button onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors">
            <Globe className="w-3.5 h-3.5" /> Nueva auditoría
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-400">{error}</div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4">
              <FolderOpen className="w-7 h-7 text-zinc-500" />
            </div>
            <p className="text-zinc-400 font-medium mb-1">Sin proyectos guardados</p>
            <p className="text-zinc-600 text-sm">Realizá una auditoría y guardala para verla aquí.</p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="space-y-3">
            {projects.map(p => (
              <div key={p.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors group">
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Domain + date */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-zinc-200 truncate">{p.domain}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {new Date(p.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{p.total_pages} página{p.total_pages !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Scores */}
                  <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-zinc-600 mb-1">Global</p>
                      <ScoreBadge score={p.avg_score} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-zinc-600 mb-1">SEO</p>
                      <ScoreBadge score={p.avg_seo} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(p.id, p.domain)}
                      disabled={deleting === p.id}
                      className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      {deleting === p.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                    >
                      Ver <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
