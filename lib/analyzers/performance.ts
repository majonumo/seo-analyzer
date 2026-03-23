// lib/analyzers/performance.ts
// Analiza el HTML estático para detectar issues de performance.
// Spec: spec/features/PERFORMANCE_MODULE.md

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { calculateModuleScore } from '../scoring'
import type {
  Check,
  ImageInfo,
  Issue,
  PerformanceResult,
  ScriptInfo,
} from '../types'

const DEPRECATED_TAGS = ['center', 'font', 'marquee', 'blink', 'strike', 'big', 'tt']

// Umbrales
const HTML_WARN_BYTES     = 100 * 1024  // 100 KB
const HTML_CRITICAL_BYTES = 500 * 1024  // 500 KB
const DOM_WARN_NODES      = 800
const DOM_CRITICAL_NODES  = 1500
const BLOCKING_WARN       = 1
const BLOCKING_CRITICAL   = 3
const IMG_ALT_WARN        = 1
const IMG_ALT_CRITICAL    = 5
const IMG_DIM_WARN        = 1
const IMG_DIM_CRITICAL    = 3
const INLINE_WARN         = 10
const INLINE_CRITICAL     = 30

// ─── Análisis principal ───────────────────────────────────────────────────────

export function analyzePerformance(
  html: string,
  htmlSizeBytes: number,
  _url: string,
): PerformanceResult {
  const $ = cheerio.load(html)
  const checks: Check[] = []
  const issues: Issue[]  = []

  // ── HTML Size ──────────────────────────────────────────────────────────────
  const htmlKb = parseFloat((htmlSizeBytes / 1024).toFixed(1))
  const htmlSizeStatus =
    htmlSizeBytes > HTML_CRITICAL_BYTES ? 'fail'
    : htmlSizeBytes > HTML_WARN_BYTES   ? 'warn'
    : 'pass'

  checks.push({
    id: 'perf-html-size',
    label: 'Tamaño HTML',
    status: htmlSizeStatus,
    severity: htmlSizeBytes > HTML_CRITICAL_BYTES ? 'critical' : 'warning',
    value: `${htmlKb} KB`,
  })

  if (htmlSizeStatus !== 'pass') {
    const threshold = htmlSizeBytes > HTML_CRITICAL_BYTES ? '500 KB' : '100 KB'
    issues.push({
      id: 'perf-html-size',
      category: 'performance',
      severity: htmlSizeBytes > HTML_CRITICAL_BYTES ? 'critical' : 'warning',
      title: 'HTML demasiado pesado',
      description: `El HTML pesa ${htmlKb} KB. Supera el umbral de ${threshold}.`,
      how_to_fix: 'Minimizar HTML, eliminar comentarios, reducir whitespace y contenido inline innecesario.',
      value: `${htmlKb} KB`,
    })
  }

  // ── DOM Size ───────────────────────────────────────────────────────────────
  const domNodeCount = $('*').length
  const domStatus =
    domNodeCount > DOM_CRITICAL_NODES ? 'fail'
    : domNodeCount > DOM_WARN_NODES   ? 'warn'
    : 'pass'

  checks.push({
    id: 'perf-dom-size',
    label: 'Nodos DOM totales',
    status: domStatus,
    severity: domNodeCount > DOM_CRITICAL_NODES ? 'critical' : 'warning',
    value: `${domNodeCount.toLocaleString()} nodos`,
  })

  if (domStatus !== 'pass') {
    issues.push({
      id: 'perf-dom-size',
      category: 'performance',
      severity: domNodeCount > DOM_CRITICAL_NODES ? 'critical' : 'warning',
      title: 'DOM excesivamente grande',
      description: `Se detectaron ${domNodeCount.toLocaleString()} nodos DOM. Lighthouse recomienda menos de ${DOM_WARN_NODES}.`,
      how_to_fix: 'Simplificar la estructura HTML, usar lazy loading para secciones fuera del viewport.',
      value: `${domNodeCount} nodos`,
    })
  }

  // ── Blocking Scripts ───────────────────────────────────────────────────────
  const allHeadScripts: ScriptInfo[] = []

  $('head script[src]').each((_, el) => {
    const attribs   = (el as Element & { attribs: Record<string, string> }).attribs
    const src       = attribs['src'] ?? ''
    const isBlocking = !('async' in attribs) && !('defer' in attribs)
    allHeadScripts.push({ src, isBlocking })
  })

  const blockingScripts = allHeadScripts.filter(s => s.isBlocking)
  const blockingCount   = blockingScripts.length
  const blockingStatus  =
    blockingCount >= BLOCKING_CRITICAL ? 'fail'
    : blockingCount >= BLOCKING_WARN   ? 'warn'
    : 'pass'

  // Count all scripts (head + body)
  const totalScripts = $('script[src]').length

  checks.push({
    id: 'perf-blocking-scripts',
    label: 'Scripts bloqueantes en <head>',
    status: blockingStatus,
    severity: blockingCount >= BLOCKING_CRITICAL ? 'critical' : 'warning',
    value: blockingCount > 0 ? `${blockingCount} bloqueante${blockingCount > 1 ? 's' : ''}` : '0',
  })

  if (blockingStatus !== 'pass') {
    issues.push({
      id: 'perf-blocking-scripts',
      category: 'performance',
      severity: blockingCount >= BLOCKING_CRITICAL ? 'critical' : 'warning',
      title: `Scripts bloqueantes detectados`,
      description: `${blockingCount} script${blockingCount > 1 ? 's' : ''} sin async/defer en el <head>.`,
      how_to_fix: 'Agregar defer o async al script: <script src="..." defer>. O moverlo al final del <body>.',
      value: `${blockingCount} scripts`,
      docs_url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#defer',
    })
  }

  // ── Images ─────────────────────────────────────────────────────────────────
  const allImages: ImageInfo[] = []

  $('img').each((_, el) => {
    const attribs  = (el as Element & { attribs: Record<string, string> }).attribs
    const src      = attribs['src'] ?? attribs['data-src'] ?? ''
    const alt      = attribs['alt']
    const hasAlt   = alt !== undefined
    const hasWidth  = !!attribs['width']
    const hasHeight = !!attribs['height']
    allImages.push({ src, hasAlt, hasWidth, hasHeight, alt })
  })

  const imagesWithoutAlt        = allImages.filter(img => !img.hasAlt)
  const imagesWithoutDimensions = allImages.filter(img => !img.hasWidth || !img.hasHeight)

  const altStatus =
    imagesWithoutAlt.length >= IMG_ALT_CRITICAL ? 'fail'
    : imagesWithoutAlt.length >= IMG_ALT_WARN   ? 'warn'
    : 'pass'

  const dimStatus =
    imagesWithoutDimensions.length >= IMG_DIM_CRITICAL ? 'fail'
    : imagesWithoutDimensions.length >= IMG_DIM_WARN   ? 'warn'
    : 'pass'

  checks.push({
    id: 'perf-images-alt',
    label: 'Imágenes sin atributo alt',
    status: altStatus,
    severity: imagesWithoutAlt.length >= IMG_ALT_CRITICAL ? 'critical' : 'warning',
    value: altStatus === 'pass' ? `${allImages.length} imágenes OK` : `${imagesWithoutAlt.length} sin alt`,
  })

  checks.push({
    id: 'perf-images-dimensions',
    label: 'Imágenes sin dimensiones definidas',
    status: dimStatus,
    severity: imagesWithoutDimensions.length >= IMG_DIM_CRITICAL ? 'critical' : 'warning',
    value: dimStatus === 'pass' ? 'Todas tienen dimensiones' : `${imagesWithoutDimensions.length} sin width/height`,
  })

  if (altStatus !== 'pass') {
    issues.push({
      id: 'perf-images-alt',
      category: 'performance',
      severity: imagesWithoutAlt.length >= IMG_ALT_CRITICAL ? 'critical' : 'warning',
      title: 'Imágenes sin atributo alt',
      description: `${imagesWithoutAlt.length} imagen${imagesWithoutAlt.length > 1 ? 'es' : ''} no tiene atributo alt.`,
      how_to_fix: 'Agregar alt descriptivo a cada imagen. Para imágenes decorativas: alt="".',
      value: `${imagesWithoutAlt.length} imágenes`,
      docs_url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt',
    })
  }

  if (dimStatus !== 'pass') {
    issues.push({
      id: 'perf-images-dimensions',
      category: 'performance',
      severity: imagesWithoutDimensions.length >= IMG_DIM_CRITICAL ? 'critical' : 'warning',
      title: 'Imágenes sin dimensiones definidas',
      description: `${imagesWithoutDimensions.length} imagen${imagesWithoutDimensions.length > 1 ? 'es' : ''} no tiene width y height definidos.`,
      how_to_fix: 'Definir width y height para evitar Cumulative Layout Shift (CLS).',
      value: `${imagesWithoutDimensions.length} imágenes`,
      docs_url: 'https://web.dev/articles/cls',
    })
  }

  // ── Inline styles ──────────────────────────────────────────────────────────
  const inlineStyleCount = $('[style]').length
  const inlineStatus =
    inlineStyleCount > INLINE_CRITICAL ? 'fail'
    : inlineStyleCount > INLINE_WARN   ? 'warn'
    : 'pass'

  checks.push({
    id: 'perf-inline-styles',
    label: 'Estilos inline excesivos',
    status: inlineStatus,
    severity: inlineStyleCount > INLINE_CRITICAL ? 'warning' : 'info',
    value: `${inlineStyleCount} elementos con style=""`,
  })

  // ── Deprecated tags ────────────────────────────────────────────────────────
  const foundDeprecated = DEPRECATED_TAGS.filter(tag => $(tag).length > 0)
  const deprecatedStatus =
    foundDeprecated.length >= 3 ? 'fail'
    : foundDeprecated.length >= 1 ? 'warn'
    : 'pass'

  checks.push({
    id: 'perf-deprecated-tags',
    label: 'Tags HTML deprecados',
    status: deprecatedStatus,
    severity: foundDeprecated.length >= 3 ? 'critical' : 'warning',
    value: foundDeprecated.length > 0 ? foundDeprecated.join(', ') : undefined,
  })

  if (deprecatedStatus !== 'pass') {
    issues.push({
      id: 'perf-deprecated-tags',
      category: 'performance',
      severity: foundDeprecated.length >= 3 ? 'critical' : 'warning',
      title: 'Tags HTML deprecados detectados',
      description: `Se encontraron: ${foundDeprecated.map(t => `<${t}>`).join(', ')}.`,
      how_to_fix: 'Reemplazar con CSS equivalente. Ej: <center> → margin: 0 auto.',
      value: foundDeprecated.join(', '),
    })
  }

  // ── Viewport meta ──────────────────────────────────────────────────────────
  const hasViewportMeta = $('meta[name="viewport"]').length > 0

  checks.push({
    id: 'perf-viewport-meta',
    label: 'Viewport meta presente',
    status: hasViewportMeta ? 'pass' : 'fail',
    severity: 'critical',
    value: hasViewportMeta
      ? $('meta[name="viewport"]').attr('content')
      : undefined,
  })

  if (!hasViewportMeta) {
    issues.push({
      id: 'perf-viewport-meta',
      category: 'performance',
      severity: 'critical',
      title: 'Viewport meta ausente',
      description: 'No se encontró <meta name="viewport">. La página puede no ser responsive.',
      how_to_fix: 'Agregar <meta name="viewport" content="width=device-width, initial-scale=1"> en el <head>.',
      docs_url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag',
    })
  }

  // ── Favicon ────────────────────────────────────────────────────────────────
  const hasFavicon =
    $('link[rel="icon"]').length > 0 ||
    $('link[rel="shortcut icon"]').length > 0 ||
    $('link[rel="apple-touch-icon"]').length > 0

  checks.push({
    id: 'perf-favicon',
    label: 'Favicon presente',
    status: hasFavicon ? 'pass' : 'fail',
    severity: 'info',
  })

  // ── Score ──────────────────────────────────────────────────────────────────
  // perf-blocking-scripts y perf-viewport-meta tienen peso 2x (manejado en calculateModuleScore via severity critical)
  const score = calculateModuleScore(checks)

  return {
    score,
    checks,
    html: { bytes: htmlSizeBytes, kilobytes: htmlKb },
    dom: { nodeCount: domNodeCount },
    scripts: { total: totalScripts, blocking: blockingScripts },
    images: {
      total: allImages.length,
      withoutAlt: imagesWithoutAlt,
      withoutDimensions: imagesWithoutDimensions,
    },
    deprecatedTags: foundDeprecated,
    hasViewportMeta,
    hasFavicon,
    inlineStyleCount,
  }
}
