'use client'
// components/dashboard/Dashboard.tsx

import type { AnalysisResult, ActiveTab, SeverityFilter, LighthouseResult } from '@/lib/types'
import { ScoreRing } from '@/components/shared/ScoreRing'
import { getScoreLabel, getScoreColor, scoreColorClasses, severityClasses } from '@/lib/scoring'
import { getDomain, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Search, Zap, ChevronRight, Gauge, FileText, Sparkles } from 'lucide-react'

interface Props {
  result: AnalysisResult
  lighthouseOverride?: LighthouseResult | null
  onTabChange: (tab: ActiveTab) => void
  onSeverityFilter: (s: SeverityFilter) => void
}

export function Dashboard({ result, lighthouseOverride, onTabChange, onSeverityFilter }: Props) {
  const { globalScore, seo, performance: perf, sitemap, issues, url, analyzedAt } = result
  const lighthouse = lighthouseOverride ?? result.lighthouse

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount  = issues.filter(i => i.severity === 'warning').length
  const infoCount     = issues.filter(i => i.severity === 'info').length

  const color  = getScoreColor(globalScore)
  const label  = getScoreLabel(globalScore)
  const colors = scoreColorClasses[color]

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Global score card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <ScoreRing score={globalScore} size="lg" />
          <div className="text-center sm:text-left">
            <div className={cn('text-2xl font-bold mb-1', colors.text)}>{label}</div>
            <div className="text-zinc-400 text-sm mb-1 font-mono">{getDomain(url)}</div>
            <div className="text-zinc-600 text-xs">
              {new Date(analyzedAt).toLocaleString('es-AR', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ModuleCard
          icon={<Search className="w-4 h-4" />}
          label="SEO"
          score={seo.score}
          passedChecks={seo.checks.filter(c => c.status === 'pass').length}
          totalChecks={seo.checks.length}
          onClick={() => onTabChange('seo')}
        />
        <ModuleCard
          icon={<Zap className="w-4 h-4" />}
          label="Performance (estático)"
          score={perf.score}
          passedChecks={perf.checks.filter(c => c.status === 'pass').length}
          totalChecks={perf.checks.length}
          onClick={() => onTabChange('performance')}
        />
        <ModuleCard
          icon={<Gauge className="w-4 h-4" />}
          label="Lighthouse"
          score={lighthouse.available ? lighthouse.performanceScore : 0}
          passedChecks={lighthouse.available ? Math.round(lighthouse.performanceScore / 10) : 0}
          totalChecks={10}
          onClick={() => onTabChange('lighthouse')}
          dimmed={!lighthouse.available}
          dimmedLabel="Abrí el tab →"
        />
        <ModuleCard
          icon={<FileText className="w-4 h-4" />}
          label="Sitemap"
          score={sitemap.score}
          passedChecks={sitemap.checks.filter(c => c.status === 'pass').length}
          totalChecks={sitemap.checks.length}
          onClick={() => onTabChange('sitemap')}
        />
      </div>

      {/* AI Report CTA */}
      <button
        onClick={() => onTabChange('ai-report')}
        className="w-full rounded-2xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40 transition-all p-4 flex items-center gap-3 text-left group"
      >
        <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-violet-300">Reporte IA con Gemini</div>
          <div className="text-xs text-zinc-500">Análisis profundo, hallazgos clave y acciones prioritarias generadas por IA</div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
      </button>

      {/* Issues summary */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-zinc-200">Issues encontrados</h3>
          <button
            onClick={() => onTabChange('issues')}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            Ver todos <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SeverityChip
            count={criticalCount}
            severity="critical"
            label="Críticos"
            onClick={() => onSeverityFilter('critical')}
          />
          <SeverityChip
            count={warningCount}
            severity="warning"
            label="Warnings"
            onClick={() => onSeverityFilter('warning')}
          />
          <SeverityChip
            count={infoCount}
            severity="info"
            label="Info"
            onClick={() => onSeverityFilter('info')}
          />
        </div>

        {/* Top 3 issues preview */}
        {issues.length > 0 && (
          <div className="mt-5 space-y-2">
            {issues.slice(0, 3).map(issue => (
              <div key={issue.id} className="flex items-start gap-3 py-2 border-t border-zinc-800">
                <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', severityClasses[issue.severity].dot)} />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{issue.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{truncate(issue.description, 72)}</p>
                </div>
              </div>
            ))}
            {issues.length > 3 && (
              <button
                onClick={() => onTabChange('issues')}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 py-2 transition-colors"
              >
                +{issues.length - 3} issues más
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ModuleCard ────────────────────────────────────────────────────────────────

function ModuleCard({
  icon, label, score, passedChecks, totalChecks, onClick, dimmed, dimmedLabel,
}: {
  icon: React.ReactNode
  label: string
  score: number
  passedChecks: number
  totalChecks: number
  onClick: () => void
  dimmed?: boolean
  dimmedLabel?: string
}) {
  const color  = dimmed ? 'red' : getScoreColor(score)
  const colors = scoreColorClasses[color]
  const pct    = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0

  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left hover:border-zinc-700 hover:bg-zinc-800/60 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-zinc-400">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {dimmed && dimmedLabel && (
            <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{dimmedLabel}</span>
          )}
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
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', colors.bg.replace('/10', ''))}
              style={{ width: `${pct}%`, backgroundColor: score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' }}
            />
          </div>
        </div>
      </div>
    </button>
  )
}

// ── SeverityChip ──────────────────────────────────────────────────────────────

function SeverityChip({
  count, severity, label, onClick,
}: {
  count: number
  severity: 'critical' | 'warning' | 'info'
  label: string
  onClick: () => void
}) {
  const classes = severityClasses[severity]

  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={cn(
        'flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all',
        count > 0
          ? cn(classes.bg, classes.border, 'cursor-pointer hover:opacity-80 border')
          : 'bg-zinc-800/40 border-zinc-800 opacity-40 cursor-default',
        'border'
      )}
    >
      <span className={cn('text-xl font-bold tabular-nums', count > 0 ? classes.text : 'text-zinc-500')}>
        {count}
      </span>
      <span className={cn('text-xs mt-0.5', count > 0 ? classes.text : 'text-zinc-600')}>
        {label}
      </span>
    </button>
  )
}
