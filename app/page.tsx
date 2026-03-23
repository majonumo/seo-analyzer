'use client'
// app/page.tsx — SEO Analyzer · Site Audit (página única con tabs)

import { useState, useCallback } from 'react'
import type { PageAuditResult, AiReport, Issue, LighthouseResult } from '@/lib/types'
import { ScoreRing } from '@/components/shared/ScoreRing'
import { getScoreColor, getScoreLabel, scoreColorClasses, severityClasses } from '@/lib/scoring'
import { normalizeUrl, getDomain, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Search, Globe, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Sparkles, ChevronDown, ChevronUp, ChevronRight,
  Monitor, Smartphone, Gauge, FileText, RotateCcw,
  Save, FolderOpen, Check,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step     = 'input' | 'urls-found' | 'progress' | 'results'
type AuditTab = 'dashboard' | 'seo' | 'lighthouse' | 'sitemap' | 'issues' | 'ai-report'

interface SitemapData { found: boolean; sitemapUrl?: string; urls: string[]; total: number }
interface LighthousePageResult { url: string; mobile: LighthouseResult | null; desktop: LighthouseResult | null; loading: boolean }

// ─── Concurrency runner ───────────────────────────────────────────────────────

async function runWithConcurrency(
  urls: string[], concurrency: number, onResult: (r: PageAuditResult) => void,
) {
  const queue = [...urls]
  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()!
      try {
        const res = await fetch('/api/site-audit/page', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
        })
        onResult(await res.json() as PageAuditResult)
      } catch {
        onResult({ url, status: 'error', score: 0, seoScore: 0, perfScore: 0, title: null, issueCount: { critical: 0, warning: 0, info: 0 }, issues: [], error: 'Error de red' })
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

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

// ─── PageRow (expandable) ─────────────────────────────────────────────────────

function PageRow({ result, category }: { result: PageAuditResult; category?: Issue['category'] }) {
  const [expanded, setExpanded] = useState(false)
  const issues = category ? result.issues.filter(i => i.category === category) : result.issues
  const hasIssues = issues.length > 0

  return (
    <>
      <tr
        className={cn('border-b border-zinc-800/40 transition-colors', hasIssues ? 'cursor-pointer hover:bg-zinc-800/20' : '')}
        onClick={() => hasIssues && setExpanded(v => !v)}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {hasIssues ? (expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />)
              : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm text-zinc-300 truncate max-w-xs font-mono">{result.url}</p>
              {result.title && <p className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">{result.title}</p>}
              {result.status === 'error' && <p className="text-xs text-red-400">{result.error}</p>}
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

// ─── Lighthouse nav section ───────────────────────────────────────────────────

function LighthouseNavRow({ result }: { result: LighthousePageResult }) {
  const [expanded, setExpanded] = useState(false)
  const mobile  = result.mobile
  const desktop = result.desktop as (LighthouseResult['desktop'] & { performanceScore: number }) | null
  const hasProblems = (mobile?.opportunities?.length ?? 0) > 0 || (mobile?.diagnostics?.length ?? 0) > 0

  return (
    <>
      <div
        className={cn('px-5 py-3 flex items-center gap-4 flex-wrap transition-colors', hasProblems && !result.loading ? 'cursor-pointer hover:bg-zinc-800/20' : '')}
        onClick={() => hasProblems && !result.loading && setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {result.loading ? <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin flex-shrink-0" />
            : hasProblems ? (expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />)
            : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
          <span className="text-xs text-zinc-400 font-mono truncate">{result.url}</span>
        </div>
        {!result.loading && mobile?.available && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-zinc-500" /><ScoreBadge score={mobile.performanceScore} /></div>
            {desktop && <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-zinc-500" /><ScoreBadge score={desktop.performanceScore} /></div>}
          </div>
        )}
        {!result.loading && !mobile?.available && <span className="text-xs text-red-400 flex-shrink-0">Error</span>}
      </div>
      {expanded && mobile?.available && (
        <div className="px-5 pb-4 border-t border-zinc-800/60 bg-zinc-950/40">
          {mobile.opportunities.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Oportunidades de mejora</p>
              <div className="space-y-2">
                {mobile.opportunities.map((opp, i) => (
                  <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-zinc-200">{opp.title}</p>
                      {opp.displayValue && <span className="text-xs font-mono text-amber-400 flex-shrink-0">{opp.displayValue}</span>}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{opp.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mobile.diagnostics.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Diagnósticos</p>
              <div className="space-y-2">
                {mobile.diagnostics.map((d, i) => (
                  <div key={i} className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-zinc-200">{d.title}</p>
                      {d.displayValue && <span className="text-xs font-mono text-zinc-400 flex-shrink-0">{d.displayValue}</span>}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{d.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function LighthouseNavSection({ navUrls, onResults }: { navUrls: string[]; onResults: (r: LighthousePageResult[]) => void }) {
  const [results, setResults] = useState<LighthousePageResult[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone]       = useState(false)

  async function runLighthouse() {
    setRunning(true); setDone(false)
    const initial = navUrls.map(url => ({ url, mobile: null, desktop: null, loading: true }))
    setResults(initial)
    const final: LighthousePageResult[] = [...initial]

    await Promise.all(navUrls.map(async (url, i) => {
      try {
        const res  = await fetch('/api/lighthouse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
        const data = await res.json() as LighthouseResult & { desktop?: LighthouseResult['desktop'] }
        const mobile: LighthouseResult = { available: data.available, performanceScore: data.performanceScore, metrics: data.metrics, opportunities: data.opportunities, diagnostics: data.diagnostics }
        const updated = { url, mobile, desktop: (data.desktop ?? null) as LighthouseResult | null, loading: false }
        final[i] = updated
        setResults(prev => prev.map((r, j) => j === i ? updated : r))
      } catch {
        final[i] = { ...final[i], loading: false }
        setResults(prev => prev.map((r, j) => j === i ? { ...r, loading: false } : r))
      }
    }))

    setRunning(false); setDone(true); onResults(final)
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Gauge className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Lighthouse — Páginas Principales</h3>
              <p className="text-xs text-zinc-500">{navUrls.length} páginas del menú · Click en cada una para ver problemas</p>
            </div>
          </div>
          {!done && (
            <button onClick={runLighthouse} disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
              {running ? 'Auditando...' : 'Ejecutar Lighthouse'}
            </button>
          )}
        </div>
        {results.length === 0
          ? <div className="px-5 py-8 text-sm text-zinc-500 text-center">Ejecutá Lighthouse para ver métricas reales de velocidad (LCP, FCP, CLS) en las páginas principales.</div>
          : <div className="divide-y divide-zinc-800/60">{results.map((r, i) => <LighthouseNavRow key={i} result={r} />)}</div>
        }
      </div>
    </div>
  )
}

// ─── AI Report display ────────────────────────────────────────────────────────

function ExpandableSection({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-800/40 transition-colors">
        <span className="text-sm font-semibold text-zinc-200">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      {open && <div className="px-5 pb-5"><p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{content}</p></div>}
    </div>
  )
}

function AiReportDisplay({ report }: { report: AiReport }) {
  if (!report.available) return (
    <div className="flex flex-col items-center text-center gap-3 py-8">
      <AlertTriangle className="w-8 h-8 text-amber-400" />
      <p className="text-sm text-zinc-400">{report.error}</p>
    </div>
  )
  return (
    <div className="space-y-5">
      {report.summary && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-300 leading-relaxed">{report.summary}</p>
          </div>
        </div>
      )}
      {report.keyFindings && report.keyFindings.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h4 className="text-sm font-semibold text-zinc-200 mb-3">Hallazgos clave</h4>
          <ul className="space-y-2">
            {report.keyFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.priorityActions && report.priorityActions.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h4 className="text-sm font-semibold text-zinc-200 mb-3">Acciones prioritarias</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 pr-4 font-medium">Acción</th>
                <th className="text-left py-2 pr-4 font-medium">Impacto</th>
                <th className="text-left py-2 font-medium">Esfuerzo</th>
              </tr></thead>
              <tbody>
                {report.priorityActions.map((a, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="py-2.5 pr-4 text-zinc-300">{a.action}</td>
                    <td className="py-2.5 pr-4">
                      <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-medium border',
                        a.impact === 'high' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                        a.impact === 'medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                        'text-zinc-400 bg-zinc-700/40 border-zinc-700')}>
                        {a.impact === 'high' ? 'Alto' : a.impact === 'medium' ? 'Medio' : 'Bajo'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-medium border',
                        a.effort === 'low' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                        a.effort === 'medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                        'text-red-400 bg-red-500/10 border-red-500/20')}>
                        {a.effort === 'low' ? 'Bajo' : a.effort === 'medium' ? 'Medio' : 'Alto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {report.sections && report.sections.length > 0 && (
        <div className="space-y-3">
          {report.sections.map((s, i) => <ExpandableSection key={i} title={s.title} content={s.content} />)}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function DashboardTab({
  results, sitemapData, lighthouseNavResults, avgScore, avgSeo, avgPerf,
  completedAt, domain, onTabChange,
}: {
  results: PageAuditResult[]
  sitemapData: SitemapData | null
  lighthouseNavResults: LighthousePageResult[]
  avgScore: number; avgSeo: number; avgPerf: number
  completedAt: string; domain: string
  onTabChange: (t: AuditTab) => void
}) {
  const color  = getScoreColor(avgScore)
  const label  = getScoreLabel(avgScore)
  const colors = scoreColorClasses[color]

  const allIssues    = results.flatMap(r => r.issues)
  const critCount    = allIssues.filter(i => i.severity === 'critical').length
  const warnCount    = allIssues.filter(i => i.severity === 'warning').length
  const infoCount    = allIssues.filter(i => i.severity === 'info').length
  const topIssues    = getTopIssues(allIssues)

  // Lighthouse avg
  const lhAvailable  = lighthouseNavResults.filter(r => r.mobile?.available)
  const lhScore      = lhAvailable.length
    ? Math.round(lhAvailable.reduce((s, r) => s + r.mobile!.performanceScore, 0) / lhAvailable.length)
    : 0
  const lhRun        = lighthouseNavResults.length > 0

  const sitemapScore = sitemapData?.found ? 100 : 0

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Global score card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <ScoreRing score={avgScore} size="lg" />
          <div className="text-center sm:text-left">
            <div className={cn('text-2xl font-bold mb-1', colors.text)}>{label}</div>
            <div className="text-zinc-400 text-sm mb-1 font-mono">{domain}</div>
            <div className="text-zinc-600 text-xs">
              {new Date(completedAt).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-zinc-600 text-xs mt-1">{results.length} páginas auditadas</div>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ModuleCard icon={<Search className="w-4 h-4" />} label="SEO" score={avgSeo}
          passedChecks={Math.round(avgSeo / 10)} totalChecks={10} onClick={() => onTabChange('seo')} />
        <ModuleCard icon={<Gauge className="w-4 h-4" />} label="Lighthouse" score={lhRun ? lhScore : 0}
          passedChecks={lhRun ? Math.round(lhScore / 10) : 0} totalChecks={10}
          onClick={() => onTabChange('lighthouse')}
          dimmed={!lhRun} dimmedLabel="Ejecutar →" />
        <ModuleCard icon={<FileText className="w-4 h-4" />} label="Sitemap" score={sitemapScore}
          passedChecks={sitemapData?.found ? 5 : 0} totalChecks={5} onClick={() => onTabChange('sitemap')} />
      </div>

      {/* AI Report CTA */}
      <button onClick={() => onTabChange('ai-report')}
        className="w-full rounded-2xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40 transition-all p-4 flex items-center gap-3 text-left group">
        <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-violet-300">Reporte IA con Gemini</div>
          <div className="text-xs text-zinc-500">Análisis profundo, hallazgos clave y acciones prioritarias por URL</div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
      </button>

      {/* Issues summary */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-zinc-200">Issues encontrados</h3>
          <button onClick={() => onTabChange('issues')} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
            Ver todos <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SeverityChip count={critCount} severity="critical" label="Críticos"  onClick={() => onTabChange('issues')} />
          <SeverityChip count={warnCount} severity="warning"  label="Warnings"  onClick={() => onTabChange('issues')} />
          <SeverityChip count={infoCount} severity="info"     label="Info"       onClick={() => onTabChange('issues')} />
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
            {topIssues.length > 3 && (
              <button onClick={() => onTabChange('issues')} className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 py-2 transition-colors">
                +{allIssues.length - 3} issues más
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ModuleCard — mismo diseño que el single-site dashboard
function ModuleCard({ icon, label, score, passedChecks, totalChecks, onClick, dimmed, dimmedLabel }: {
  icon: React.ReactNode; label: string; score: number
  passedChecks: number; totalChecks: number; onClick: () => void
  dimmed?: boolean; dimmedLabel?: string
}) {
  const color  = dimmed ? 'red' : getScoreColor(score)
  const colors = scoreColorClasses[color]
  const pct    = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0

  return (
    <button onClick={onClick}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left hover:border-zinc-700 hover:bg-zinc-800/60 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-zinc-400">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {dimmed && dimmedLabel && <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{dimmedLabel}</span>}
          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </div>
      </div>
      <div className="flex items-end gap-4">
        <ScoreRing score={dimmed ? 0 : score} size="sm" />
        <div className="flex-1 pb-1">
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>{passedChecks}/{totalChecks} checks</span>
            <span className={colors.text}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' }} />
          </div>
        </div>
      </div>
    </button>
  )
}

function SeverityChip({ count, severity, label, onClick }: { count: number; severity: 'critical' | 'warning' | 'info'; label: string; onClick: () => void }) {
  const classes = severityClasses[severity]
  return (
    <button onClick={onClick} disabled={count === 0}
      className={cn('flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all',
        count > 0 ? cn(classes.bg, classes.border, 'cursor-pointer hover:opacity-80') : 'bg-zinc-800/40 border-zinc-800 opacity-40 cursor-default', 'border')}>
      <span className={cn('text-xl font-bold tabular-nums', count > 0 ? classes.text : 'text-zinc-500')}>{count}</span>
      <span className={cn('text-xs mt-0.5', count > 0 ? classes.text : 'text-zinc-600')}>{label}</span>
    </button>
  )
}

// ─── Tab: Pages table (Issues / SEO / Performance) ───────────────────────────

function PagesTable({ results, category, sortBy }: { results: PageAuditResult[]; category?: Issue['category']; sortBy: 'score' | 'seoScore' | 'perfScore' }) {
  const sorted = [...results].sort((a, b) => a[sortBy] - b[sortBy])
  const totalCrit = results.reduce((s, r) => s + r.issueCount.critical, 0)
  const totalWarn = results.reduce((s, r) => s + r.issueCount.warning, 0)

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Páginas auditadas (peor primero)</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Click en una fila para ver los issues detallados</p>
          </div>
          <div className="flex gap-2">
            {totalCrit > 0 && <IssueBadge count={totalCrit} label="críticos" type="critical" />}
            {totalWarn > 0 && <IssueBadge count={totalWarn} label="advertencias" type="warning" />}
          </div>
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

      {/* Top issues for this category */}
      {(() => {
        const issues = category ? results.flatMap(r => r.issues.filter(i => i.category === category)) : results.flatMap(r => r.issues)
        const top = getTopIssues(issues)
        if (top.length === 0) return null
        return (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-200">Issues más frecuentes</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Ordenados por frecuencia en el sitio</p>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {top.slice(0, 10).map((item, i) => (
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
        )
      })()}
    </div>
  )
}

// ─── Tab: Sitemap ─────────────────────────────────────────────────────────────

function SitemapTab({ sitemapData, auditUrls }: { sitemapData: SitemapData | null; auditUrls: string[] }) {
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className={cn('w-12 h-12 rounded-xl border flex items-center justify-center',
            sitemapData?.found ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20')}>
            {sitemapData?.found
              ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              : <XCircle className="w-6 h-6 text-red-400" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">{sitemapData?.found ? 'Sitemap encontrado' : 'Sitemap no encontrado'}</h3>
            {sitemapData?.sitemapUrl && <p className="text-xs text-zinc-500 mt-0.5 font-mono">{sitemapData.sitemapUrl}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-xs text-zinc-500 mb-1">URLs en sitemap</p>
            <p className="text-2xl font-bold text-zinc-100">{sitemapData?.total ?? 0}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-xs text-zinc-500 mb-1">Páginas auditadas</p>
            <p className="text-2xl font-bold text-emerald-400">{auditUrls.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-xs text-zinc-500 mb-1">Estado</p>
            <p className={cn('text-base font-semibold', sitemapData?.found ? 'text-emerald-400' : 'text-red-400')}>
              {sitemapData?.found ? 'Activo' : 'No detectado'}
            </p>
          </div>
        </div>
      </div>

      {auditUrls.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">URLs auditadas</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{auditUrls.length} páginas</p>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-96 overflow-y-auto">
            {auditUrls.map((u, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                <span className="text-xs text-zinc-400 font-mono truncate">{u}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: IA Report ───────────────────────────────────────────────────────────

function AiReportTab({ results, auditUrls, urlInput, lighthouseNavResults }: {
  results: PageAuditResult[]; auditUrls: string[]; urlInput: string; lighthouseNavResults: LighthousePageResult[]
}) {
  const [aiReport, setAiReport]   = useState<AiReport | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handleGenerate = useCallback(async () => {
    setAiLoading(true); setAiReport(null)
    try {
      const domain = getDomain(auditUrls[0] ?? urlInput)
      const lighthousePages = lighthouseNavResults
        .filter(r => r.mobile?.available)
        .map(r => {
          const desktop = r.desktop as (LighthouseResult['desktop'] & { performanceScore: number }) | null
          return {
            url: r.url, mobileScore: r.mobile!.performanceScore, desktopScore: desktop?.performanceScore,
            opportunities: r.mobile!.opportunities.map(o => ({ title: o.title, displayValue: o.displayValue })),
            diagnostics:   r.mobile!.diagnostics.map(d => ({ title: d.title, displayValue: d.displayValue })),
          }
        })
      const res = await fetch('/api/site-audit/ai-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: results, domain, lighthousePages }),
      })
      setAiReport(await res.json() as AiReport)
    } catch {
      setAiReport({ available: false, error: 'Error de red al generar el reporte.' })
    } finally {
      setAiLoading(false)
    }
  }, [results, auditUrls, urlInput, lighthouseNavResults])

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="rounded-2xl border border-violet-500/20 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-violet-500/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Reporte IA del Sitio</h3>
              <p className="text-xs text-zinc-500">URL por URL — errores, descripción y qué hacer</p>
            </div>
          </div>
          {!aiReport && !aiLoading && (
            <button onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Generar Reporte IA
            </button>
          )}
          {aiReport && (
            <button onClick={handleGenerate} disabled={aiLoading}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" /> Regenerar
            </button>
          )}
        </div>
        <div className="p-5">
          {!aiReport && !aiLoading && (
            <p className="text-sm text-zinc-500 text-center py-6">
              Generá un reporte IA para obtener análisis por URL con errores específicos, impacto y plan de acción.
            </p>
          )}
          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-300">Analizando cada URL con Gemini...</p>
                <p className="text-xs text-zinc-500 mt-1">Puede tomar unos segundos.</p>
              </div>
            </div>
          )}
          {aiReport && <AiReportDisplay report={aiReport} />}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [step, setStep]             = useState<Step>('input')
  const [urlInput, setUrlInput]     = useState('')
  const [inputError, setInputError] = useState('')
  const [detecting, setDetecting]   = useState(false)

  const [sitemapData, setSitemapData]   = useState<SitemapData | null>(null)
  const [auditUrls, setAuditUrls]       = useState<string[]>([])
  const [navUrls, setNavUrls]           = useState<string[]>([])
  const [results, setResults]           = useState<PageAuditResult[]>([])
  const [currentUrl, setCurrentUrl]     = useState('')
  const [completedAt, setCompletedAt]   = useState('')
  const [lighthouseNavResults, setLighthouseNavResults] = useState<LighthousePageResult[]>([])

  const [activeTab, setActiveTab] = useState<AuditTab>('dashboard')
  const [saving, setSaving]       = useState(false)
  const [savedId, setSavedId]     = useState<string | null>(null)

  const activeDomain = auditUrls[0] ? getDomain(auditUrls[0]) : ''
  const totalUrls    = auditUrls.length
  const totalPages   = results.length
  const success      = results.filter(r => r.status === 'success')
  const avgScore     = success.length ? Math.round(success.reduce((s, r) => s + r.score,     0) / success.length) : 0
  const avgSeo       = success.length ? Math.round(success.reduce((s, r) => s + r.seoScore,  0) / success.length) : 0
  const avgPerf      = success.length ? Math.round(success.reduce((s, r) => s + r.perfScore, 0) / success.length) : 0
  const sortedResults = [...results].sort((a, b) => a.score - b.score)

  const allIssues = results.flatMap(r => r.issues)
  const issueCount = allIssues.length

  const TABS: { id: AuditTab; label: string }[] = [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'seo',        label: 'SEO' },
    { id: 'lighthouse', label: 'Lighthouse' },
    { id: 'sitemap',    label: 'Sitemap' },
    { id: 'issues',     label: `Issues (${issueCount})` },
    { id: 'ai-report',  label: 'IA Report' },
  ]

  async function handleDetect(e: React.FormEvent) {
    e.preventDefault()
    setInputError('')
    const trimmed = urlInput.trim()
    if (!trimmed) { setInputError('Ingresá una URL para auditar.'); return }
    const normalized = normalizeUrl(trimmed)
    try { new URL(normalized) } catch { setInputError('URL inválida.'); return }

    setDetecting(true)
    try {
      const [sRes, nRes] = await Promise.all([
        fetch(`/api/site-audit/urls?url=${encodeURIComponent(normalized)}`),
        fetch(`/api/site-audit/nav-urls?url=${encodeURIComponent(normalized)}`),
      ])
      const sm  = await sRes.json() as SitemapData
      const nav = await nRes.json() as { urls: string[]; count: number }
      setSitemapData(sm)
      setNavUrls(nav.urls)
      setAuditUrls(!sm.found || sm.urls.length === 0 ? [normalized] : sm.urls)
      setStep('urls-found')
    } catch {
      setInputError('Error de red al detectar el sitemap.')
    } finally {
      setDetecting(false)
    }
  }

  async function handleStartAudit() {
    setResults([])
    setCurrentUrl('')
    setLighthouseNavResults([])
    setActiveTab('dashboard')
    setStep('progress')

    await runWithConcurrency([...auditUrls], 3, r => {
      setCurrentUrl(r.url)
      setResults(prev => [...prev, r])
    })

    setCompletedAt(new Date().toISOString())
    setStep('results')
  }

  async function handleSave() {
    if (saving || savedId) return
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain:             activeDomain,
          avg_score:          avgScore,
          avg_seo:            avgSeo,
          avg_perf:           avgPerf,
          total_pages:        results.length,
          completed_at:       completedAt,
          sitemap_url:        sitemapData?.sitemapUrl ?? null,
          audit_urls:         auditUrls,
          nav_urls:           navUrls,
          results,
          lighthouse_results: lighthouseNavResults
            .filter(r => r.mobile?.available)
            .map(r => ({ ...r.mobile, url: r.url, desktop: r.desktop })),
        }),
      })
      const data = await res.json()
      if (data.id) setSavedId(data.id)
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setStep('input')
    setSavedId(null)
    setResults([])
    setSitemapData(null)
    setAuditUrls([])
    setNavUrls([])
    setUrlInput('')
    setLighthouseNavResults([])
    setActiveTab('dashboard')
  }

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 px-6 py-3 sticky top-0 z-40 bg-zinc-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            {step !== 'input' && (
              <button onClick={handleReset} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
              <Search className="w-4 h-4 text-zinc-950" />
            </div>
            <span className="font-semibold text-sm tracking-tight">
              {step === 'input' ? 'SEO Analyzer' : activeDomain}
            </span>
          </div>

          {step !== 'input' && (
            <form onSubmit={handleDetect} className="flex-1 flex gap-2 max-w-xl">
              <input type="text" value={urlInput} onChange={e => { setUrlInput(e.target.value); setInputError('') }}
                placeholder={auditUrls[0] ?? 'https://example.com'}
                disabled={detecting || step === 'progress'}
                className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button type="submit" disabled={detecting || step === 'progress'}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1.5">
                {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Analizar
              </button>
            </form>
          )}

          {/* Botón guardar + link proyectos (solo en results) */}
          {step === 'results' && (
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <a href="/projects" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-xs transition-colors">
                <FolderOpen className="w-3.5 h-3.5" /> Proyectos
              </a>
              {savedId ? (
                <a href={`/projects/${savedId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors hover:bg-emerald-500/30">
                  <Check className="w-3.5 h-3.5" /> Guardado
                </a>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Tabs (results only) ─────────────────────────────────────────────── */}
      {step === 'results' && (
        <div className="border-b border-zinc-800 px-6 sticky top-[53px] z-30 bg-zinc-950/90 backdrop-blur">
          <div className="max-w-6xl mx-auto flex gap-0.5 overflow-x-auto scrollbar-none">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? tab.id === 'ai-report' ? 'border-violet-500 text-violet-400' : 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.id === 'ai-report' && <Sparkles className="w-3 h-3" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className={cn('flex-1', step === 'results' ? 'px-6 py-8' : 'flex flex-col')}>

        {/* IDLE */}
        {step === 'input' && (
          <>
            <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <Globe className="w-7 h-7 text-emerald-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Site Audit</h1>
              <p className="text-zinc-400 text-base mb-6 max-w-lg">Auditá todas las páginas de tu sitio — SEO, Performance y Lighthouse en páginas principales</p>
              <div className="flex items-center gap-4 mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Sin costo · hasta 100 páginas · Lighthouse solo en navegación
              </div>
              <a href="/projects" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-700 bg-zinc-800/50 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                <FolderOpen className="w-3 h-3" /> Mis proyectos
              </a>
            </div>
              <form onSubmit={handleDetect} className="w-full max-w-2xl">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">https://</span>
                    <input type="text" value={urlInput} onChange={e => { setUrlInput(e.target.value); setInputError('') }}
                      placeholder="example.com" autoFocus disabled={detecting}
                      className="w-full pl-24 pr-4 py-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors" />
                  </div>
                  <button type="submit" disabled={detecting}
                    className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-2">
                    {detecting ? <><Loader2 className="w-4 h-4 animate-spin" />Detectando...</> : 'Detectar páginas'}
                  </button>
                </div>
                {inputError && <p className="mt-2 text-sm text-red-400 text-left">{inputError}</p>}
              </form>
            </section>
            <footer className="border-t border-zinc-800 px-6 py-4 text-center text-xs text-zinc-600">SEO Analyzer — Site Audit</footer>
          </>
        )}

        {/* URLS FOUND */}
        {step === 'urls-found' && sitemapData !== null && (
          <div className="flex-1 flex items-start justify-center px-6 py-12">
            <section className="w-full max-w-2xl">
              {sitemapData.found && auditUrls.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-100">{sitemapData.total} página{sitemapData.total !== 1 ? 's' : ''} encontradas</h2>
                      {sitemapData.sitemapUrl && <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-md font-mono">{sitemapData.sitemapUrl}</p>}
                    </div>
                  </div>
                  {navUrls.length > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-4 flex gap-3">
                      <Gauge className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-zinc-300">
                        <span className="font-semibold text-amber-300">{navUrls.length} páginas de navegación detectadas</span> — Lighthouse solo en estas al finalizar.
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 mb-6 overflow-hidden">
                    {auditUrls.slice(0, 10).map((u, i) => <div key={i} className="px-4 py-2.5 text-sm text-zinc-400 font-mono truncate">{u}</div>)}
                    {auditUrls.length > 10 && <div className="px-4 py-2.5 text-sm text-zinc-500 italic">... y {auditUrls.length - 10} páginas más</div>}
                  </div>
                  <button onClick={handleStartAudit} className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors mb-2">
                    Auditar {auditUrls.length} página{auditUrls.length !== 1 ? 's' : ''}
                  </button>
                  <p className="text-center text-xs text-zinc-500">SEO + Performance por página · Lighthouse solo en páginas de navegación</p>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-3 mb-6">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-300 mb-1">No se detectó sitemap</p>
                      <p className="text-sm text-zinc-400">Se auditará solo la URL ingresada.</p>
                    </div>
                  </div>
                  <button onClick={handleStartAudit} className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors">
                    Auditar página principal
                  </button>
                </>
              )}
            </section>
          </div>
        )}

        {/* PROGRESS */}
        {step === 'progress' && (
          <div className="flex-1 flex items-start justify-center px-6 py-12">
            <section className="w-full max-w-3xl">
              <h2 className="text-2xl font-bold mb-2">Auditando sitio...</h2>
              <p className="text-zinc-500 text-sm mb-8">Analizando {totalUrls} página{totalUrls !== 1 ? 's' : ''} · 3 en paralelo</p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mb-6">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-zinc-300 font-medium">{totalPages} / {totalUrls} páginas</span>
                  <span className="text-zinc-500">{totalUrls > 0 ? Math.round((totalPages / totalUrls) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: totalUrls > 0 ? `${(totalPages / totalUrls) * 100}%` : '0%' }} />
                </div>
                {currentUrl && <p className="mt-3 text-xs text-zinc-500 truncate">Analizando: {currentUrl}</p>}
              </div>
              {results.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-300">Resultados en tiempo real</h3>
                  </div>
                  <div className="divide-y divide-zinc-800/60 max-h-72 overflow-y-auto">
                    {[...results].reverse().map((r, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                        {r.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <span className="text-sm text-zinc-400 truncate flex-1 font-mono">{r.url}</span>
                        {r.status === 'success' ? <ScoreBadge score={r.score} /> : <span className="text-xs text-red-400">Error</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* RESULTS */}
        {step === 'results' && (
          <div className="max-w-6xl mx-auto w-full">
            {activeTab === 'dashboard' && (
              <DashboardTab
                results={results} sitemapData={sitemapData}
                lighthouseNavResults={lighthouseNavResults}
                avgScore={avgScore} avgSeo={avgSeo} avgPerf={avgPerf}
                completedAt={completedAt} domain={activeDomain}
                onTabChange={setActiveTab}
              />
            )}
            {activeTab === 'seo' && (
              <PagesTable results={sortedResults} category="seo" sortBy="seoScore" />
            )}
            {/* Lighthouse — siempre montado para preservar estado al cambiar de pestaña */}
            <div className={activeTab === 'lighthouse' ? '' : 'hidden'}>
              {navUrls.length > 0
                ? <LighthouseNavSection navUrls={navUrls} onResults={setLighthouseNavResults} />
                : (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                      <Gauge className="w-7 h-7 text-amber-400" />
                    </div>
                    <p className="text-zinc-400 text-sm">No se detectaron páginas de navegación para ejecutar Lighthouse.</p>
                  </div>
                )
              }
            </div>
            {activeTab === 'sitemap' && (
              <SitemapTab sitemapData={sitemapData} auditUrls={auditUrls} />
            )}
            {activeTab === 'issues' && (
              <PagesTable results={sortedResults} sortBy="score" />
            )}
            {activeTab === 'ai-report' && (
              <AiReportTab results={results} auditUrls={auditUrls} urlInput={urlInput} lighthouseNavResults={lighthouseNavResults} />
            )}
          </div>
        )}

      </div>
    </main>
  )
}
