// lib/analyzers/hreflang.ts — Validación de etiquetas hreflang
// Crítico para sitios hoteleros en MX / US / FR

import * as cheerio from 'cheerio'

// ─── BCP-47 patterns ─────────────────────────────────────────────────────────
// Acepta: es-MX  en-US  fr-FR  es  en  fr  x-default  zh-Hant  pt-BR  etc.
const BCP47_RE = /^([a-z]{2,3})(-[A-Z]{2,4})?$|^x-default$/

// Códigos genéricos que idealmente deberían ser específicos para hoteles
const GENERIC_CODES = ['es', 'en', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar']

export interface HreflangTag {
  lang:  string
  href:  string
  valid: boolean    // BCP-47 válido
  issue?: string
}

export interface HreflangIssue {
  type:        string
  severity:    'critical' | 'high' | 'low'
  description: string
  recommendation: string
}

export interface HreflangResult {
  found:       boolean
  count:       number
  tags:        HreflangTag[]
  hasXDefault: boolean
  issues:      HreflangIssue[]
}

export function analyzeHreflang(html: string, _pageUrl: string): HreflangResult {
  const $ = cheerio.load(html)
  const alternates = $('link[rel="alternate"][hreflang]')

  if (alternates.length === 0) {
    // No hreflang — no necesariamente un problema (si el sitio es monolingüe)
    return { found: false, count: 0, tags: [], hasXDefault: false, issues: [] }
  }

  const tags: HreflangTag[] = []
  const issueMap = new Map<string, HreflangIssue>()

  alternates.each((_, el) => {
    const lang = ($(el).attr('hreflang') ?? '').trim()
    const href = ($(el).attr('href') ?? '').trim()

    let valid = true
    let issue: string | undefined

    if (!BCP47_RE.test(lang)) {
      valid = false
      issue = `Código BCP-47 inválido: "${lang}"`
      issueMap.set(`invalid-${lang}`, {
        type:           'hreflang_wrong_code',
        severity:       'critical',
        description:    `Código de idioma "${lang}" no cumple el estándar BCP-47.`,
        recommendation: 'Usar códigos como es-MX, en-US, fr-FR, x-default.',
      })
    } else if (GENERIC_CODES.includes(lang)) {
      issue = `Código genérico "${lang}" sin región`
      issueMap.set(`generic-${lang}`, {
        type:           'hreflang_wrong_code',
        severity:       'high',
        description:    `Código genérico "${lang}" sin región. Para hoteles en MX/US/FR se recomienda especificar la región.`,
        recommendation: `Reemplazar "${lang}" por el código específico: es→es-MX, en→en-US, fr→fr-FR.`,
      })
    }

    tags.push({ lang, href, valid, issue })
  })

  const hasXDefault = tags.some(t => t.lang === 'x-default')

  // x-default es obligatorio cuando hay más de un idioma
  if (!hasXDefault && tags.length > 1) {
    issueMap.set('no-xdefault', {
      type:           'hreflang_no_xdefault',
      severity:       'high',
      description:    'Falta la etiqueta hreflang x-default. Es obligatoria cuando hay múltiples variantes de idioma.',
      recommendation: 'Agregar <link rel="alternate" hreflang="x-default" href="URL-principal"> en el <head>.',
    })
  }

  // Detectar duplicados de idioma
  const seen = new Set<string>()
  tags.forEach(t => {
    if (seen.has(t.lang)) {
      issueMap.set(`dup-${t.lang}`, {
        type:           'hreflang_wrong_code',
        severity:       'high',
        description:    `Idioma "${t.lang}" aparece duplicado en las etiquetas hreflang.`,
        recommendation: 'Cada idioma/región debe aparecer una sola vez.',
      })
    }
    seen.add(t.lang)
  })

  return {
    found:       true,
    count:       tags.length,
    tags,
    hasXDefault,
    issues:      Array.from(issueMap.values()),
  }
}
