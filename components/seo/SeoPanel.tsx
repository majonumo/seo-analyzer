'use client'
// components/seo/SeoPanel.tsx

import type { SeoResult } from '@/lib/types'
import { ScoreRing } from '@/components/shared/ScoreRing'
import { CheckRow } from '@/components/shared/CheckRow'
import { getScoreLabel } from '@/lib/scoring'
import { cn } from '@/lib/utils'

interface Props { seo: SeoResult }

export function SeoPanel({ seo }: Props) {
  return (
    <div className="space-y-6 animate-slide-up">
      {/* Score header */}
      <div className="flex items-center gap-5 p-6 rounded-2xl border border-zinc-800 bg-zinc-900">
        <ScoreRing score={seo.score} size="md" />
        <div>
          <h2 className="text-lg font-semibold">SEO On-Page</h2>
          <p className="text-zinc-400 text-sm">{getScoreLabel(seo.score)} · {seo.checks.filter(c => c.status === 'pass').length}/{seo.checks.length} checks OK</p>
        </div>
      </div>

      {/* Meta */}
      <Section title="Meta Tags">
        <InfoRow label="Title" value={seo.meta.title} fallback="No encontrado" />
        <InfoRow label="Length" value={seo.meta.title ? `${seo.meta.titleLength} caracteres` : undefined} />
        <InfoRow label="Description" value={seo.meta.description} fallback="No encontrada" />
        <InfoRow label="Length" value={seo.meta.description ? `${seo.meta.descriptionLength} caracteres` : undefined} />
      </Section>

      {/* Headings */}
      <Section title="Headings">
        {seo.headings.h1s.length === 0 ? (
          <p className="text-sm text-red-400 py-2">No se encontraron H1</p>
        ) : (
          seo.headings.h1s.map((h, i) => (
            <InfoRow key={i} label={`H1 ${seo.headings.h1s.length > 1 ? `#${i + 1}` : ''}`} value={h} />
          ))
        )}
        {seo.headings.h2s.slice(0, 5).map((h, i) => (
          <InfoRow key={i} label={`H2 #${i + 1}`} value={h} />
        ))}
        {seo.headings.h2s.length > 5 && (
          <p className="text-xs text-zinc-500 py-1">+{seo.headings.h2s.length - 5} H2 más</p>
        )}
      </Section>

      {/* Open Graph */}
      <Section title="Open Graph">
        <InfoRow label="og:title"       value={seo.openGraph.title}       fallback="No encontrado" />
        <InfoRow label="og:description" value={seo.openGraph.description} fallback="No encontrada" />
        <InfoRow label="og:image"       value={seo.openGraph.image}       fallback="No encontrada" mono />
        <InfoRow label="og:type"        value={seo.openGraph.type}        fallback="No encontrado" />

        {/* OG Preview */}
        {(seo.openGraph.title || seo.openGraph.description) && (
          <OGPreview og={seo.openGraph} />
        )}
      </Section>

      {/* Canonical */}
      <Section title="Canonical">
        <InfoRow label="href" value={seo.canonical.href} fallback="No encontrado" mono />
        {seo.canonical.href && (
          <InfoRow
            label="¿Apunta a sí mismo?"
            value={seo.canonical.isSelf ? 'Sí ✓' : 'No ⚠'}
            valueClass={seo.canonical.isSelf ? 'text-emerald-400' : 'text-amber-400'}
          />
        )}
      </Section>

      {/* Schema */}
      <Section title="Schema.org">
        {seo.schema.found ? (
          seo.schema.items.map((item, i) => (
            <div key={i} className="py-2 border-b border-zinc-800 last:border-0">
              <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">
                @type: {item.type}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500 py-2">No se detectó structured data (JSON-LD)</p>
        )}
      </Section>

      {/* All checks */}
      <Section title="Todos los checks">
        {seo.checks.map(c => <CheckRow key={c.id} check={c} showSeverity />)}
      </Section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({
  label, value, fallback, mono, valueClass,
}: {
  label: string
  value?: string | null
  fallback?: string
  mono?: boolean
  valueClass?: string
}) {
  const display = value ?? fallback
  if (!display) return null

  return (
    <div className="flex gap-3 py-2 border-b border-zinc-800/60 last:border-0">
      <span className="text-xs text-zinc-500 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className={cn(
        'text-sm break-all',
        mono ? 'font-mono text-zinc-300' : 'text-zinc-200',
        !value && 'text-zinc-600 italic',
        valueClass,
      )}>
        {display}
      </span>
    </div>
  )
}

function OGPreview({ og }: { og: SeoResult['openGraph'] }) {
  return (
    <div className="mt-4 rounded-xl border border-zinc-700 overflow-hidden bg-zinc-800">
      {og.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={og.image}
          alt="OG preview"
          className="w-full h-40 object-cover"
          onError={e => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div className="p-3">
        {og.url && <p className="text-xs text-zinc-500 uppercase mb-1">{new URL(og.url).hostname}</p>}
        {og.title && <p className="text-sm font-semibold text-zinc-200 line-clamp-1">{og.title}</p>}
        {og.description && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{og.description}</p>}
      </div>
    </div>
  )
}
