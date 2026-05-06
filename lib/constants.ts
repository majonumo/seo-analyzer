// lib/constants.ts
// Constantes compartidas por los analizadores y las API routes de site-audit.
// Fuente única de verdad — no duplicar en otros archivos.

import type { Severity } from './types'

// ─── Orden de severidad para sorting ─────────────────────────────────────────

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning:  1,
  info:     2,
}

// ─── Orden de categorías para sorting ────────────────────────────────────────

export const CATEGORY_ORDER: Record<string, number> = {
  seo:         0,
  performance: 1,
  sitemap:     2,
}

// ─── Guías de corrección por check ID ────────────────────────────────────────

export const HOW_TO_FIX: Record<string, string> = {
  'seo-title-exists':        'Agregar <title>Tu título aquí</title> dentro del <head>.',
  'seo-title-length':        'Ajustar el título a entre 30 y 60 caracteres para evitar truncamiento en SERPs.',
  'seo-desc-exists':         'Agregar <meta name="description" content="Tu descripción"> en el <head>.',
  'seo-desc-length':         'Ajustar a 120–160 chars para evitar truncamiento en Google.',
  'seo-h1-exists':           'Agregar un <h1> con la keyword principal de la página.',
  'seo-h1-unique':           'Conservar un único <h1> y usar <h2>–<h6> para subtítulos.',
  'seo-h2-exists':           'Agregar al menos un <h2> para estructurar el contenido.',
  'seo-canonical-exists':    'Agregar <link rel="canonical" href="URL"> en el <head>.',
  'seo-canonical-self':      'Verificar que el canonical sea la URL canónica correcta de la página.',
  'seo-og-title':            'Agregar <meta property="og:title" content="Título"> en el <head>.',
  'seo-og-description':      'Agregar <meta property="og:description" content="Descripción"> en el <head>.',
  'seo-og-image':            'Agregar <meta property="og:image" content="URL imagen"> (1200×630px recomendado).',
  'seo-schema-exists':       'Agregar structured data en formato JSON-LD para habilitar rich results.',
  'seo-robots-noindex':      'Eliminar el tag noindex si querés que Google indexe esta página.',
  'perf-html-size':          'Minimizar HTML, eliminar comentarios, reducir whitespace y contenido inline innecesario.',
  'perf-dom-size':           'Simplificar la estructura HTML, usar lazy loading para secciones fuera del viewport.',
  'perf-blocking-scripts':   'Agregar defer o async al script: <script src="..." defer>.',
  'perf-images-alt':         'Agregar alt descriptivo a cada imagen. Para imágenes decorativas: alt="".',
  'perf-images-dimensions':  'Definir width y height en cada <img> para evitar Cumulative Layout Shift (CLS).',
  'perf-inline-styles':      'Mover los estilos a clases CSS en un archivo externo o en <style>.',
  'perf-deprecated-tags':    'Reemplazar con CSS equivalente. Ej: <center> → margin: 0 auto.',
  'perf-viewport-meta':      'Agregar <meta name="viewport" content="width=device-width, initial-scale=1"> en el <head>.',
  'perf-favicon':            'Agregar <link rel="icon" href="/favicon.ico"> en el <head>.',
  'sitemap-found':           'Crear un sitemap.xml en la raíz del sitio y declararlo en robots.txt con "Sitemap: /sitemap.xml".',
  'sitemap-valid-xml':       'Validar el sitemap en https://www.xml-sitemaps.com/validate-xml-sitemap.html.',
  'sitemap-has-urls':        'Agregar las URLs principales del sitio al sitemap.',
  'sitemap-lastmod':         'Agregar el atributo <lastmod> con la fecha de última modificación de cada URL.',
  'sitemap-priority':        'Agregar <priority> (0.0–1.0) para indicar la importancia relativa de cada URL.',
  'sitemap-warnings':        'Revisar las advertencias del sitemap y corregirlas para mejorar la indexación.',
}

// ─── URLs de documentación por check ID ──────────────────────────────────────

export const DOCS_URLS: Record<string, string> = {
  'seo-title-exists':       'https://developers.google.com/search/docs/appearance/title-link',
  'seo-desc-exists':        'https://developers.google.com/search/docs/appearance/snippet',
  'seo-canonical-self':     'https://developers.google.com/search/docs/crawling-indexing/canonicalization',
  'seo-og-title':           'https://ogp.me/',
  'seo-schema-exists':      'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  'seo-robots-noindex':     'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
  'perf-blocking-scripts':  'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#defer',
  'perf-images-alt':        'https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt',
  'perf-images-dimensions': 'https://web.dev/articles/cls',
  'perf-viewport-meta':     'https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag',
  'sitemap-found':          'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
  'sitemap-valid-xml':      'https://www.sitemaps.org/protocol.html',
  'sitemap-lastmod':        'https://www.sitemaps.org/protocol.html#lastmoddef',
}
