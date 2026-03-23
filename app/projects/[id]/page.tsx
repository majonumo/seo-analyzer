'use client'
// app/projects/[id]/page.tsx — vista de un proyecto guardado (replica el dashboard)

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { PageAuditResult, AiReport, Issue, LighthouseResult } from '@/lib/types'
import type { ProjectRow } from '@/lib/supabase'
import { ScoreRing } from '@/components/shared/ScoreRing'
import { getScoreColor, getScoreLabel, scoreColorClasses, severityClasses } from '@/lib/scoring'
import { getDomain, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Search, ArrowLeft, Loader2, AlertTriangle, CheckCircle2,
  Sparkles, ChevronDown, ChevronUp, ChevronRight,
  Monitor, Smartphone, Gauge, FileText, Globe, FolderOpen,
} from 'lucide-react'

type AuditTab = 'dashboard' | 'seo' | 'lighthouse' | 'sitemap' | 'issues' | 'ai-report'

// ─── Helpers (same as main page) ─────────────────────────────────────────────

function ScoreBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const c = scoreColorClasses[getScoreColor(score)]
  const s = { sm: 'text-xs px-2 py-0.5 min-w-[2.5rem]', md: 'text-sm px-2.5 py-1 min-w-[3rem]', lg: 'text-base px-3 py-1.5 min-w-[3.5rem] font-bold' }
  return <span className={cn('inline-flex items-center justify-center rounded-md font-semibold border', c.text, c.bg, c.border, s[size])}>{score}</span>
}

function SeverityDot({ severity }: { severity: Issue['severity'] }) {
  return <span className={cn('w-2 h-2 rounded-full flex-shrink-0', { critical: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-indigo-500' }[severity])} />
}

function IssueBadge({ count, label, type }: { count: number; label: string; type: 'critical' | 'warning' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium',
      type === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>
      {count} {label}
    </span>
  )
}

function getTopIssues(issues: Issue[]) {
  const map = new Map<string, Issue & { count: number }>()
  for (const i of issues) {
    if (map.has(i.id)) map.get(i.id)!.count++
    else map.set(i.id, { ...i, count: 1 })
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function PageRow({ result, category }: { result: PageAuditResult; category?: Issue['category'] }) {
  const [expanded, setExpanded] = useState(false)
  const issues = category ? result.issues.filter(i => i.category === category) : result.issues
  const hasIssues = issues.length > 0

  return (
    <>
      <tr className={cn('border-b border-zinc-800/40 transition-colors', hasIssues ? 'cursor-pointer hover:bg-zinc-800/20' : '')}
        onClick={() => hasIssues && setExpanded(v => !v)}>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {hasIssues ? (expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />)
              : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm text-zinc-300 truncate max-w-xs font-mono">{result.url}</p>
              {result.title && <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">{result.title}</p>}
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-center"><ScoreBadge score={result.score} /></td>
        <td className="px-3 py-3 text-center"><ScoreBadge score={result.seoScore} /></td>
        <td className="px-3 py-3 text-center"><ScoreBadge score={result.perfScore} /></td>
        <td className="px-3 py-3">
          <div className="flex gap-1.5 flex-wrap">
            {result.issueCount.critical > 0 && <IssueBadge count={result.issueCount.critical} label="crit." type="critical" />}
            {result.issueCount.warning  > 0 && <IssueBadge count={result.issueCount.warning}  label="warn." type="warning" />}
            {!result.issueCount.critical && !result.issueCount.warning && <span className="text-xs text-emerald-500">OK</span>}
          </div>
        </td>
      </tr>
      {expanded && hasIssues && (
        <tr className="border-b border-zinc-800/40 bg-zinc-950/60">
          <td colSpan={5} className="px-5 py-4">
            <div className="space-y-2">
              {issues.map((issue, i) => (
                <div key={i} className={cn('rounded-lg border p-3 text-sm',
                  issue.severity === 'critical' ? 'border-red-500/20 bg-red-500/5'
                    : issue.severity === 'warning' ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-zinc-700 bg-zinc-900')}>
                  <div className="flex items-start gap-2 mb-1">
                    <SeverityDot severity={issue.severity} />
                    <span className={cn('font-semibold text-xs uppercase tracking-wide',
                      issue.severity === 'critical' ? 'text-red-400' : issue.severity === 'warning' ? 'text-amber-400' : 'text-indigo-400')}>
                      {issue.severity}
                    </span>
                    <span className="text-zinc-200 font-medium">{issue.title}</span>
                  </div>
                  {issue.value && <p className="text-xs text-zinc-400 mb-1 ml-4 font-mono">{issue.value}</p>}
                  <p className="text-xs text-zinc-500 mb-1.5 ml-4">{issue.description}</p>
                  <div className={cn('ml-4 mt-1.5 text-xs px-2.5 py-1.5 rounded-md border',
                    issue.severity === 'critical' ? 'border-red-500/20 bg-red-500/10 text-red-300'
                      : issue.severity === 'warning' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400')}>
                    <span className="font-semibold">Solución: </span>{issue.how_to_fix}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function PagesTable({ results, category, sortBy }: { results: PageAuditResult[]; category?: Issue['category']; sortBy: 'score' | 'seoScore' | 'perfScore' }) {
  const sorted = [...results].sort((a, b) => a[sortBy] - b[sortBy])
  const topIssues = getTopIssues(category ? results.flatMap(r => r.issues.filter(i => i.category === category)) : results.flatMap(r => r.issues))

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Páginas auditadas (peor primero)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                <th className="text-left px-5 py-3 font-medium">URL</th>
                <th className="text-center px-3 py-3 font-medium">Score</th>
                <th className="text-center px-3 py-3 font-medium">SEO</th>
                <th className="text-center px-3 py-3 font-medium">Perf</th>
                <th className="text-left px-3 py-3 font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>{sorted.map((r, i) => <PageRow key={i} result={r} category={category} />)}</tbody>
          </table>
        </div>
      </div>
      {topIssues.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">Issues más frecuentes</h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {topIssues.slice(0, 10).map((item, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <SeverityDot severity={item.severity} />
                    <span className="text-sm text-zinc-300 truncate">{item.title}</span>
                  </div>
                  <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">{item.count}×</span>
                </div>
                <p className="text-xs text-zinc-500 ml-5">{item.how_to_fix}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [activeTab, setActiveTab] = useState<AuditTab>('dashboard')

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject('No encontrado'))
      .then(setProject)
      .catch(() => setError('No se pudo cargar el proyecto.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
    </div>
  )

  if (error || !project) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertTriangle className="w-8 h-8 text-amber-400" />
      <p className="text-zinc-400 text-sm">{error || 'Proyecto no encontrado'}</p>
      <button onClick={() => router.push('/projects')} className="text-emerald-400 text-sm hover:underline">← Volver a proyectos</button>
    </div>
  )

  const results      = project.results ?? []
  const lhResults    = (project.lighthouse_results ?? []) as (LighthouseResult & { url: string })[]
  const success      = results.filter(r => r.status === 'success')
  const avgScore     = project.avg_score
  const avgSeo       = project.avg_seo
  const avgPerf      = project.avg_perf
  const allIssues    = results.flatMap(r => r.issues)
  const critCount    = allIssues.filter(i => i.severity === 'critical').length
  const warnCount    = allIssues.filter(i => i.severity === 'warning').length
  const infoCount    = allIssues.filter(i => i.severity === 'info').length
  const topIssues    = getTopIssues(allIssues)
  const sortedResults = [...results].sort((a, b) => a.score - b.score)
  const lhScore      = lhResults.length ? Math.round(lhResults.reduce((s, r) => s + (r.performanceScore ?? 0), 0) / lhResults.length) : 0

  const color  = getScoreColor(avgScore)
  const label  = getScoreLabel(avgScore)
  const colors = scoreColorClasses[color]

  const TABS: { id: AuditTab; label: string }[] = [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'seo',        label: 'SEO' },
    { id: 'lighthouse', label: 'Lighthouse' },
    { id: 'sitemap',    label: 'Sitemap' },
    { id: 'issues',     label: `Issues (${allIssues.length})` },
    { id: 'ai-report',  label: 'IA Report' },
  ]

  function ModuleCard({ icon, label: cardLabel, score, passed, total, onClick, dimmed, dimmedLabel }: {
    icon: React.ReactNode; label: string; score: number; passed: number; total: number
    onClick: () => void; dimmed?: boolean; dimmedLabel?: string
  }) {
    const c   = scoreColorClasses[dimmed ? 'red' : getScoreColor(score)]
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0
    return (
      <button onClick={onClick} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left hover:border-zinc-700 hover:bg-zinc-800/60 transition-all group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-400">{icon}<span className="text-sm font-medium">{cardLabel}</span></div>
          <div className="flex items-center gap-2">
            {dimmed && dimmedLabel && <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{dimmedLabel}</span>}
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </div>
        </div>
        <div className="flex items-end gap-4">
          <ScoreRing score={dimmed ? 0 : score} size="sm" />
          <div className="flex-1 pb-1">
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>{passed}/{total} checks</span>
              <span className={c.text}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' }} />
            </div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 sticky top-0 z-40 bg-zinc-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/projects')} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
            <Search className="w-4 h-4 text-zinc-950" />
          </div>
          <span className="font-semibold text-sm tracking-tight">{project.domain}</span>
          <span className="text-xs text-zinc-600 ml-auto">
            {new Date(project.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6 sticky top-[53px] z-30 bg-zinc-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto flex gap-0.5 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.id === 'ai-report' ? 'border-violet-500 text-violet-400' : 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}>
              {tab.id === 'ai-report' && <Sparkles className="w-3 h-3" />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">

          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <ScoreRing score={avgScore} size="lg" />
                  <div className="text-center sm:text-left">
                    <div className={cn('text-2xl font-bold mb-1', colors.text)}>{label}</div>
                    <div className="text-zinc-400 text-sm mb-1 font-mono">{project.domain}</div>
                    <div className="text-zinc-600 text-xs">
                      {new Date(project.completed_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-zinc-600 text-xs mt-1">{results.length} páginas auditadas</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ModuleCard icon={<Search className="w-4 h-4" />} label="SEO" score={avgSeo}
                  passed={Math.round(avgSeo / 10)} total={10} onClick={() => setActiveTab('seo')} />
                <ModuleCard icon={<Gauge className="w-4 h-4" />} label="Lighthouse" score={lhResults.length ? lhScore : 0}
                  passed={lhResults.length ? Math.round(lhScore / 10) : 0} total={10}
                  onClick={() => setActiveTab('lighthouse')}
                  dimmed={!lhResults.length} dimmedLabel="Sin datos" />
                <ModuleCard icon={<FileText className="w-4 h-4" />} label="Sitemap" score={project.sitemap_url ? 100 : 0}
                  passed={project.sitemap_url ? 5 : 0} total={5} onClick={() => setActiveTab('sitemap')} />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold text-zinc-200">Issues encontrados</h3>
                  <button onClick={() => setActiveTab('issues')} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                    Ver todos <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { count: critCount, label: 'Críticos',  sev: 'critical' as const },
                    { count: warnCount, label: 'Warnings',  sev: 'warning'  as const },
                    { count: infoCount, label: 'Info',       sev: 'info'     as const },
                  ].map(({ count, label: l, sev }) => {
                    const cls = severityClasses[sev]
                    return (
                      <div key={sev} className={cn('flex flex-col items-center justify-center py-3 px-2 rounded-xl border',
                        count > 0 ? cn(cls.bg, cls.border) : 'bg-zinc-800/40 border-zinc-800 opacity-40')}>
                        <span className={cn('text-xl font-bold', count > 0 ? cls.text : 'text-zinc-500')}>{count}</span>
                        <span className={cn('text-xs mt-0.5', count > 0 ? cls.text : 'text-zinc-600')}>{l}</span>
                      </div>
                    )
                  })}
                </div>
                {topIssues.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {topIssues.slice(0, 3).map(issue => (
                      <div key={issue.id} className="flex items-start gap-3 py-2 border-t border-zinc-800">
                        <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', severityClasses[issue.severity].dot)} />
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200 truncate">{issue.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{truncate(issue.how_to_fix, 72)}</p>
                        </div>
                        <span className="flex-shrink-0 text-xs text-zinc-600 font-mono ml-auto">{issue.count}×</span>
                      </div>
                    ))}
                    {allIssues.length > 3 && (
                      <button onClick={() => setActiveTab('issues')} className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 py-2 transition-colors">
                        +{allIssues.length - 3} issues más
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'seo' && <PagesTable results={sortedResults} category="seo" sortBy="seoScore" />}

          {activeTab === 'lighthouse' && (
            lhResults.length > 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-200">Lighthouse — Páginas principales</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{lhResults.length} páginas auditadas con Lighthouse</p>
                </div>
                <div className="divide-y divide-zinc-800/60">
                  {lhResults.map((r, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-4">
                      <span className="text-xs text-zinc-400 font-mono truncate flex-1">{(r as LighthouseResult & { url: string }).url}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-zinc-500" /><ScoreBadge score={r.performanceScore} /></div>
                        {r.desktop && <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-zinc-500" /><ScoreBadge score={r.desktop.performanceScore} /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Gauge className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">No se ejecutó Lighthouse en esta auditoría.</p>
              </div>
            )
          )}

          {activeTab === 'sitemap' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className={cn('w-12 h-12 rounded-xl border flex items-center justify-center',
                    project.sitemap_url ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20')}>
                    {project.sitemap_url ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <AlertTriangle className="w-6 h-6 text-red-400" />}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">{project.sitemap_url ? 'Sitemap encontrado' : 'Sitemap no encontrado'}</h3>
                    {project.sitemap_url && <p className="text-xs text-zinc-500 mt-0.5 font-mono">{project.sitemap_url}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <p className="text-xs text-zinc-500 mb-1">Páginas auditadas</p>
                    <p className="text-2xl font-bold text-emerald-400">{project.audit_urls?.length ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <p className="text-xs text-zinc-500 mb-1">Estado</p>
                    <p className={cn('text-base font-semibold', project.sitemap_url ? 'text-emerald-400' : 'text-red-400')}>
                      {project.sitemap_url ? 'Activo' : 'No detectado'}
                    </p>
                  </div>
                </div>
              </div>
              {project.audit_urls?.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-200">URLs auditadas</h3>
                  </div>
                  <div className="divide-y divide-zinc-800/40 max-h-96 overflow-y-auto">
                    {project.audit_urls.map((u, i) => (
                      <div key={i} className="px-5 py-2.5 flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                        <span className="text-xs text-zinc-400 font-mono truncate">{u}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'issues' && <PagesTable results={sortedResults} sortBy="score" />}

          {activeTab === 'ai-report' && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <FolderOpen className="w-7 h-7 text-violet-400" />
              </div>
              <p className="text-zinc-400 text-sm">El reporte IA no se guardó con este proyecto.</p>
              <p className="text-zinc-600 text-xs mt-1">Realizá una nueva auditoría para generarlo.</p>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
