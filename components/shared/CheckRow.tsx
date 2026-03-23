// components/shared/CheckRow.tsx
// Fila compacta para mostrar el resultado de un check individual.

import type { Check } from '@/lib/types'
import { checkStatusClasses, severityClasses } from '@/lib/scoring'
import { cn } from '@/lib/utils'

interface Props {
  check: Check
  showSeverity?: boolean
}

export function CheckRow({ check, showSeverity = false }: Props) {
  const status   = checkStatusClasses[check.status]
  const severity = severityClasses[check.severity]

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      {/* Status icon */}
      <span className={cn('text-sm font-bold w-4 text-center flex-shrink-0', status.text)}>
        {status.icon}
      </span>

      {/* Label */}
      <span className="text-sm text-zinc-200 flex-1 min-w-0">{check.label}</span>

      {/* Value */}
      {check.value && (
        <span className="text-xs font-mono text-zinc-500 truncate max-w-[160px]">
          {check.value}
        </span>
      )}

      {/* Severity badge (opcional) */}
      {showSeverity && check.status !== 'pass' && (
        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium uppercase tracking-wide flex-shrink-0', severity.badge)}>
          {check.severity}
        </span>
      )}
    </div>
  )
}
