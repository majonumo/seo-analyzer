// lib/scoring.ts
// Lógica centralizada de scoring y etiquetas visuales.

import type { Check, ScoreColor, ScoreLabel, Severity } from './types'

// ─── Score global ─────────────────────────────────────────────────────────────

// Si Lighthouse está disponible: 40% SEO + 20% análisis estático + 40% Lighthouse real
// Sin Lighthouse: 50% SEO + 50% análisis estático
export function calculateGlobalScore(seoScore: number, perfScore: number, lighthouseScore?: number): number {
  if (lighthouseScore !== undefined) {
    return Math.round(seoScore * 0.4 + perfScore * 0.2 + lighthouseScore * 0.4)
  }
  return Math.round(seoScore * 0.5 + perfScore * 0.5)
}

// ─── Score de módulo ponderado ────────────────────────────────────────────────
// Los checks critical cuentan 2x en el denominador.

export function calculateModuleScore(checks: Check[]): number {
  if (checks.length === 0) return 0

  let passed = 0
  let total  = 0

  for (const check of checks) {
    const weight = check.severity === 'critical' ? 2 : 1
    total += weight
    if (check.status === 'pass') {
      passed += weight
    }
  }

  return Math.round((passed / total) * 100)
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

export function getScoreColor(score: number): ScoreColor {
  if (score >= 75) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 75) return 'Bueno'
  if (score >= 50) return 'Regular'
  return 'Necesita trabajo'
}

// Clases de Tailwind para cada color de score
export const scoreColorClasses: Record<ScoreColor, {
  text: string
  bg: string
  stroke: string
  border: string
}> = {
  green: {
    text:   'text-emerald-500',
    bg:     'bg-emerald-500/10',
    stroke: 'stroke-emerald-500',
    border: 'border-emerald-500/30',
  },
  yellow: {
    text:   'text-amber-500',
    bg:     'bg-amber-500/10',
    stroke: 'stroke-amber-500',
    border: 'border-amber-500/30',
  },
  red: {
    text:   'text-red-500',
    bg:     'bg-red-500/10',
    stroke: 'stroke-red-500',
    border: 'border-red-500/30',
  },
}

// Clases de Tailwind para cada severidad de issue
export const severityClasses: Record<Severity, {
  text: string
  bg: string
  border: string
  badge: string
  dot: string
}> = {
  critical: {
    text:   'text-red-400',
    bg:     'bg-red-500/10',
    border: 'border-l-red-500',
    badge:  'bg-red-500/20 text-red-400',
    dot:    'bg-red-500',
  },
  warning: {
    text:   'text-amber-400',
    bg:     'bg-amber-500/10',
    border: 'border-l-amber-500',
    badge:  'bg-amber-500/20 text-amber-400',
    dot:    'bg-amber-500',
  },
  info: {
    text:   'text-indigo-400',
    bg:     'bg-indigo-500/10',
    border: 'border-l-indigo-500',
    badge:  'bg-indigo-500/20 text-indigo-400',
    dot:    'bg-indigo-500',
  },
}

// Clases para CheckStatus
export const checkStatusClasses: Record<'pass' | 'fail' | 'warn', {
  icon: string
  text: string
}> = {
  pass: { icon: '✓', text: 'text-emerald-500' },
  fail: { icon: '✗', text: 'text-red-500' },
  warn: { icon: '⚠', text: 'text-amber-500' },
}
