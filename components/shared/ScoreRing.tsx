'use client'
// components/shared/ScoreRing.tsx
// Círculo SVG animado con el score en el centro.

import { useEffect, useState } from 'react'
import { getScoreColor, scoreColorClasses } from '@/lib/scoring'
import { cn } from '@/lib/utils'

const RADIUS  = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // ≈ 251.33

const SIZE_MAP = {
  sm: 64,
  md: 96,
  lg: 128,
}

const TEXT_SIZE_MAP = {
  sm: 'text-lg font-bold',
  md: 'text-2xl font-bold',
  lg: 'text-4xl font-bold',
}

interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
  className?: string
}

export function ScoreRing({ score, size = 'md', animated = true, className }: Props) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!animated) return

    // Animate score counter
    let frame: number
    const duration = 700
    const start = performance.now()

    function tick(now: number) {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(eased * score))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [score, animated])

  const color     = getScoreColor(score)
  const classes   = scoreColorClasses[color]
  const px        = SIZE_MAP[size]
  const viewBox   = 100 // SVG coordinate space
  const cx = 50, cy = 50

  // Calculate stroke offset for ring fill
  const fillRatio     = mounted ? score / 100 : 0
  const dashOffset    = CIRCUMFERENCE * (1 - fillRatio)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        width={px}
        height={px}
        className="absolute inset-0 -rotate-90"
        role="img"
        aria-label={`Score: ${score}/100`}
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={RADIUS}
          fill="none"
          strokeWidth={6}
          className="stroke-zinc-800"
        />
        {/* Fill */}
        <circle
          cx={cx}
          cy={cy}
          r={RADIUS}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className={cn(classes.stroke, 'score-ring-fill')}
          style={{ transition: animated ? 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' : 'none' }}
        />
      </svg>

      {/* Score number */}
      <span className={cn(TEXT_SIZE_MAP[size], classes.text, 'relative z-10 tabular-nums')}>
        {displayScore}
      </span>
    </div>
  )
}
