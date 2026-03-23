'use client'
// components/analyzer/AnalysisLoader.tsx
// Loading state con pasos secuenciales visibles.

import { useEffect, useState } from 'react'
import { getDomain } from '@/lib/utils'

const STEPS = [
  { id: 'fetch',   label: 'Fetching URL',          duration: 1500 },
  { id: 'seo',     label: 'Analizando SEO',         duration: 1200 },
  { id: 'perf',    label: 'Chequeando Performance', duration: 1200 },
  { id: 'report',  label: 'Construyendo reporte',   duration: 800  },
]

type StepState = 'pending' | 'active' | 'done'

interface Props {
  url: string
}

export function AnalysisLoader({ url }: Props) {
  const [stepStates, setStepStates] = useState<StepState[]>(
    STEPS.map((_, i) => (i === 0 ? 'active' : 'pending'))
  )

  useEffect(() => {
    let elapsed = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    STEPS.forEach((step, i) => {
      if (i === 0) return // already active

      elapsed += STEPS[i - 1].duration
      // Mark previous as done, current as active
      timers.push(
        setTimeout(() => {
          setStepStates(prev => prev.map((s, idx) => {
            if (idx === i - 1) return 'done'
            if (idx === i)     return 'active'
            return s
          }))
        }, elapsed)
      )
    })

    // Mark last step as done
    const total = STEPS.reduce((sum, s) => sum + s.duration, 0)
    timers.push(
      setTimeout(() => {
        setStepStates(STEPS.map(() => 'done'))
      }, total)
    )

    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="w-full max-w-sm">
        {/* Domain */}
        <p className="text-center text-zinc-400 text-sm mb-10">
          Analizando{' '}
          <span className="text-zinc-200 font-medium">{getDomain(url)}</span>
        </p>

        {/* Steps */}
        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const state = stepStates[i]
            return (
              <div key={step.id} className="flex items-center gap-4">
                {/* Icon */}
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                  {state === 'done' && (
                    <span className="text-emerald-500 text-lg">✓</span>
                  )}
                  {state === 'active' && (
                    <span className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  )}
                  {state === 'pending' && (
                    <span className="w-2 h-2 rounded-full bg-zinc-700" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-sm transition-colors ${
                  state === 'active'  ? 'text-zinc-100 font-medium' :
                  state === 'done'    ? 'text-zinc-500 line-through' :
                  'text-zinc-600'
                }`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
