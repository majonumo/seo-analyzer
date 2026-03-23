'use client'
// components/performance/PerformancePanel.tsx

import type { PerformanceResult } from '@/lib/types'
import { ScoreRing } from '@/components/shared/ScoreRing'
import { CheckRow } from '@/components/shared/CheckRow'
import { getScoreLabel } from '@/lib/scoring'
import { formatBytes, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props { perf: PerformanceResult }

export function PerformancePanel({ perf }: Props) {
  const passedCount = perf.checks.filter(c => c.status === 'pass').length

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Score header */}
      <div className="flex items-center gap-5 p-6 rounded-2xl border border-zinc-800 bg-zinc-900">
        <ScoreRing score={perf.score} size="md" />
        <div>
          <h2 className="text-lg font-semibold">Performance</h2>
          <p className="text-zinc-400 text-sm">{getScoreLabel(perf.score)} · {passedCount}/{perf.checks.length} checks OK</p>
        </div>
      </div>

      {/* Metrics overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="HTML Size"   value={`${perf.html.kilobytes} KB`} warn={perf.html.kilobytes > 100} />
        <MetricCard label="DOM Nodes"   value={perf.dom.nodeCount.toLocaleString()} warn={perf.dom.nodeCount > 800} />
        <MetricCard label="Scripts bloq." value={String(perf.scripts.blocking.length)} warn={perf.scripts.blocking.length > 0} />
        <MetricCard label="Imágenes"    value={String(perf.images.total)} />
      </div>

      {/* Blocking scripts */}
      {perf.scripts.blocking.length > 0 && (
        <Section title={`Scripts bloqueantes (${perf.scripts.blocking.length})`}>
          <p className="text-xs text-zinc-500 mb-3">Scripts en &lt;head&gt; sin <code className="text-amber-400 bg-zinc-800 px-1 rounded">async</code> ni <code className="text-amber-400 bg-zinc-800 px-1 rounded">defer</code></p>
          <div className="space-y-1.5">
            {perf.scripts.blocking.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <span className="text-red-500 text-xs">⛔</span>
                <code className="text-xs font-mono text-zinc-300 truncate">{truncate(s.src, 70)}</code>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Images */}
      {perf.images.total > 0 && (
        <Section title={`Imágenes (${perf.images.total} total)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Src</th>
                  <th className="text-center py-2 px-2 text-zinc-500 font-medium w-12">alt</th>
                  <th className="text-center py-2 px-2 text-zinc-500 font-medium w-16">width</th>
                  <th className="text-center py-2 px-2 text-zinc-500 font-medium w-16">height</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...perf.images.withoutAlt,
                  ...perf.images.withoutDimensions.filter(
                    img => !perf.images.withoutAlt.find(a => a.src === img.src)
                  ),
                ].slice(0, 20).map((img, i) => (
                  <tr key={i} className="border-b border-zinc-800/40">
                    <td className="py-2 pr-4 font-mono text-zinc-400 truncate max-w-[200px]">
                      {truncate(img.src, 50)}
                    </td>
                    <td className="text-center py-2 px-2">
                      {img.hasAlt ? <span className="text-emerald-500">✓</span> : <span className="text-red-500">✗</span>}
                    </td>
                    <td className="text-center py-2 px-2">
                      {img.hasWidth ? <span className="text-emerald-500">✓</span> : <span className="text-red-500">✗</span>}
                    </td>
                    <td className="text-center py-2 px-2">
                      {img.hasHeight ? <span className="text-emerald-500">✓</span> : <span className="text-red-500">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Deprecated tags */}
      {perf.deprecatedTags.length > 0 && (
        <Section title="Tags deprecados">
          <div className="flex flex-wrap gap-2">
            {perf.deprecatedTags.map(tag => (
              <code key={tag} className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded font-mono">
                &lt;{tag}&gt;
              </code>
            ))}
          </div>
        </Section>
      )}

      {/* All checks */}
      <Section title="Todos los checks">
        {perf.checks.map(c => <CheckRow key={c.id} check={c} showSeverity />)}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function MetricCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
      <div className={cn('text-xl font-bold tabular-nums', warn ? 'text-amber-400' : 'text-zinc-200')}>
        {value}
      </div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}
