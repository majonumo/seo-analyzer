'use client'
// components/sitemap/SitemapPanel.tsx

import type { SitemapResult } from '@/lib/types'
import { CheckRow } from '@/components/shared/CheckRow'
import { ScoreRing } from '@/components/shared/ScoreRing'
import { getScoreLabel, getScoreColor, scoreColorClasses } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle, FileText, Link, Calendar } from 'lucide-react'

interface Props { sitemap: SitemapResult }

export function SitemapPanel({ sitemap }: Props) {
  const color  = getScoreColor(sitemap.score)
  const label  = getScoreLabel(sitemap.score)
  const colors = scoreColorClasses[color]

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-5">
          <ScoreRing score={sitemap.score} size="md" />
          <div>
            <div className={cn('text-xl font-bold', colors.text)}>{label}</div>
            <div className="text-zinc-400 text-sm mt-0.5">Análisis del Sitemap</div>
            {sitemap.url && (
              <div className="font-mono text-xs text-zinc-500 mt-1 break-all">{sitemap.url}</div>
            )}
          </div>
        </div>
      </div>

      {/* Status & stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Estado"
          value={sitemap.found ? 'Encontrado' : 'No encontrado'}
          icon={sitemap.found
            ? <CheckCircle className="w-4 h-4 text-emerald-400" />
            : <AlertTriangle className="w-4 h-4 text-red-400" />}
          highlight={sitemap.found ? 'green' : 'red'}
        />
        <StatCard
          label="Tipo"
          value={!sitemap.found ? '—' : sitemap.isIndex ? 'Sitemap Index' : 'Sitemap'}
          icon={<FileText className="w-4 h-4 text-zinc-400" />}
        />
        <StatCard
          label={sitemap.isIndex ? 'Sub-sitemaps' : 'URLs'}
          value={sitemap.found ? sitemap.urlCount.toString() : '0'}
          icon={<Link className="w-4 h-4 text-zinc-400" />}
        />
        <StatCard
          label="Errores"
          value={sitemap.errors.length.toString()}
          icon={<AlertTriangle className="w-4 h-4 text-zinc-400" />}
          highlight={sitemap.errors.length > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Errors */}
      {sitemap.errors.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Errores ({sitemap.errors.length})
          </h3>
          <ul className="space-y-1.5">
            {sitemap.errors.map((e, i) => (
              <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                <span className="text-red-500 flex-shrink-0">•</span>{e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {sitemap.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Advertencias ({sitemap.warnings.length})
          </h3>
          <ul className="space-y-1.5">
            {sitemap.warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-300 flex items-start gap-2">
                <span className="text-amber-500 flex-shrink-0">•</span>{w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sub-sitemaps (index) */}
      {sitemap.isIndex && sitemap.sitemaps && sitemap.sitemaps.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">Sub-sitemaps ({sitemap.sitemaps.length})</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {sitemap.sitemaps.map((s, i) => (
              <div key={i} className="font-mono text-xs text-zinc-400 py-1 border-b border-zinc-800 last:border-0 break-all">
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* URL sample */}
      {sitemap.urls.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">
            Muestra de URLs ({sitemap.urls.length}{sitemap.urlCount > sitemap.urls.length ? ` de ${sitemap.urlCount}` : ''})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-4 font-medium">URL</th>
                  <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">
                    <Calendar className="w-3 h-3 inline mr-1" />Lastmod
                  </th>
                  <th className="text-left py-2 pr-4 font-medium">Freq</th>
                  <th className="text-left py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {sitemap.urls.slice(0, 30).map((u, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-1.5 pr-4 font-mono text-zinc-300 max-w-xs truncate">{u.loc}</td>
                    <td className="py-1.5 pr-4 text-zinc-500 whitespace-nowrap">{u.lastmod ?? '—'}</td>
                    <td className="py-1.5 pr-4 text-zinc-500">{u.changefreq ?? '—'}</td>
                    <td className="py-1.5 text-zinc-500">{u.priority ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Checks */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Checks</h3>
        <div className="space-y-1">
          {sitemap.checks.map(c => (
            <CheckRow key={c.id} check={c} showSeverity />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, highlight,
}: {
  label: string
  value: string
  icon: React.ReactNode
  highlight?: 'green' | 'red'
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2 mb-2 text-zinc-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={cn(
        'text-base font-semibold',
        highlight === 'green' ? 'text-emerald-400' :
        highlight === 'red'   ? 'text-red-400'     : 'text-zinc-200',
      )}>
        {value}
      </div>
    </div>
  )
}
