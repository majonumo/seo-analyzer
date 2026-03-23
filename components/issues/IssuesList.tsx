'use client'
// components/issues/IssuesList.tsx

import { useState } from 'react'
import type { Issue, SeverityFilter, CategoryFilter } from '@/lib/types'
import { severityClasses } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import { ChevronDown, ExternalLink } from 'lucide-react'

interface Props {
  issues: Issue[]
  severityFilter: SeverityFilter
  categoryFilter: CategoryFilter
  onSeverityFilter: (s: SeverityFilter) => void
  onCategoryFilter: (c: CategoryFilter) => void
}

export function IssuesList({
  issues,
  severityFilter,
  categoryFilter,
  onSeverityFilter,
  onCategoryFilter,
}: Props) {
  const filtered = issues.filter(issue => {
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false
    if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false
    return true
  })

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount  = issues.filter(i => i.severity === 'warning').length
  const infoCount     = issues.filter(i => i.severity === 'info').length

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Severity filters */}
        {(
          [
            { id: 'all'      as SeverityFilter, label: `Todos (${issues.length})` },
            { id: 'critical' as SeverityFilter, label: `🔴 Críticos (${criticalCount})` },
            { id: 'warning'  as SeverityFilter, label: `🟡 Warnings (${warningCount})` },
            { id: 'info'     as SeverityFilter, label: `🔵 Info (${infoCount})` },
          ] as const
        ).map(f => (
          <button
            key={f.id}
            onClick={() => onSeverityFilter(f.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              severityFilter === f.id
                ? 'bg-zinc-700 text-zinc-100 font-medium'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="h-6 w-px bg-zinc-800 self-center mx-1" />

        {/* Category filters */}
        {(
          [
            { id: 'all'         as CategoryFilter, label: 'Todos' },
            { id: 'seo'         as CategoryFilter, label: 'SEO' },
            { id: 'performance' as CategoryFilter, label: 'Performance' },
            { id: 'sitemap'     as CategoryFilter, label: 'Sitemap' },
          ] as const
        ).map(f => (
          <button
            key={f.id}
            onClick={() => onCategoryFilter(f.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              categoryFilter === f.id
                ? 'bg-zinc-700 text-zinc-100 font-medium'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-sm">
          No hay issues para el filtro seleccionado 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(issue => <IssueCard key={issue.id} issue={issue} />)}
        </div>
      )}
    </div>
  )
}

// ── IssueCard ─────────────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false)
  const classes = severityClasses[issue.severity]

  return (
    <div className={cn(
      'rounded-xl border-l-4 border border-zinc-800 bg-zinc-900 overflow-hidden',
      classes.border,
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-800/50 transition-colors"
      >
        {/* Severity badge */}
        <span className={cn('text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wide flex-shrink-0 mt-0.5', classes.badge)}>
          {issue.severity}
        </span>

        {/* Category */}
        <span className="text-xs text-zinc-600 uppercase font-medium flex-shrink-0 mt-0.5 w-20">
          {issue.category}
        </span>

        {/* Title */}
        <span className="text-sm font-medium text-zinc-200 flex-1">{issue.title}</span>

        {/* Expand icon */}
        <ChevronDown className={cn(
          'w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5 transition-transform',
          expanded && 'rotate-180'
        )} />
      </button>

      {/* Description */}
      {issue.description && !expanded && (
        <p className="px-4 pb-3 text-xs text-zinc-500 -mt-1 ml-[calc(theme(spacing.3)+theme(spacing.16)+theme(spacing.20))]">
          {issue.description}
        </p>
      )}

      {/* Expanded: how to fix */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-800 mt-1">
          <p className="text-xs text-zinc-400 pt-3 mb-3">{issue.description}</p>
          <div className="rounded-lg bg-zinc-800 p-3">
            <p className="text-xs text-zinc-500 font-medium mb-1.5 uppercase tracking-wide">Cómo solucionarlo</p>
            <p className="text-sm text-zinc-200">{issue.how_to_fix}</p>
          </div>
          {issue.docs_url && (
            <a
              href={issue.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Ver documentación <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}
