// lib/types.ts
// Fuente de verdad para todos los tipos del proyecto.
// NUNCA definir tipos locales — siempre importar desde aquí.

// ─── Primitivos ───────────────────────────────────────────────────────────────

export type Severity     = 'critical' | 'warning' | 'info'
export type CheckStatus  = 'pass' | 'fail' | 'warn'
export type IssueCategory = 'seo' | 'performance' | 'sitemap'
export type ScoreColor   = 'red' | 'yellow' | 'green'
export type ScoreLabel   = 'Bueno' | 'Regular' | 'Necesita trabajo'

// ─── Checks e Issues ──────────────────────────────────────────────────────────

export interface Check {
  id: string
  label: string
  status: CheckStatus
  value?: string       // Valor encontrado (para mostrar en UI)
  severity: Severity   // Severidad si falla
}

export interface Issue {
  id: string
  category: IssueCategory
  severity: Severity
  title: string
  description: string
  how_to_fix: string
  value?: string
  docs_url?: string
}

// ─── Resultado SEO ────────────────────────────────────────────────────────────

export interface SeoMeta {
  title: string | null
  titleLength: number
  description: string | null
  descriptionLength: number
}

export interface HeadingsResult {
  h1s: string[]
  h2s: string[]
}

export interface OpenGraphResult {
  title: string | null
  description: string | null
  image: string | null
  url: string | null
  type: string | null
}

export interface CanonicalResult {
  href: string | null
  isSelf: boolean // canonical href == url analizada
}

export interface SchemaItem {
  type: string // valor de @type
  raw: Record<string, unknown>
}

export interface SchemaResult {
  found: boolean
  items: SchemaItem[]
}

export interface SeoResult {
  score: number // 0–100
  checks: Check[]
  meta: SeoMeta
  headings: HeadingsResult
  openGraph: OpenGraphResult
  canonical: CanonicalResult
  schema: SchemaResult
  robotsNoindex: boolean
}

// ─── Resultado Performance ────────────────────────────────────────────────────

export interface HtmlSizeResult {
  bytes: number
  kilobytes: number
}

export interface DomResult {
  nodeCount: number
}

export interface ScriptInfo {
  src: string
  isBlocking: boolean // en <head> sin async/defer
}

export interface ScriptsResult {
  total: number
  blocking: ScriptInfo[]
}

export interface ImageInfo {
  src: string
  hasAlt: boolean
  hasWidth: boolean
  hasHeight: boolean
  alt?: string
}

export interface ImagesResult {
  total: number
  withoutAlt: ImageInfo[]
  withoutDimensions: ImageInfo[]
}

export interface PerformanceResult {
  score: number // 0–100
  checks: Check[]
  html: HtmlSizeResult
  dom: DomResult
  scripts: ScriptsResult
  images: ImagesResult
  deprecatedTags: string[]
  hasViewportMeta: boolean
  hasFavicon: boolean
  inlineStyleCount: number
}

// ─── Lighthouse / PageSpeed Insights ─────────────────────────────────────────

export interface LighthouseMetric {
  value: number
  displayValue: string
  score: number | null // 0–1
}

export interface LighthouseOpportunity {
  id: string
  title: string
  description: string
  displayValue: string
  score: number | null
}

export interface LighthouseDiagnostic {
  id: string
  title: string
  description: string
  displayValue?: string
  score: number | null
}

export interface LighthouseStrategyData {
  performanceScore: number
  metrics: {
    fcp:        LighthouseMetric
    lcp:        LighthouseMetric
    cls:        LighthouseMetric
    tbt:        LighthouseMetric
    speedIndex: LighthouseMetric
    tti:        LighthouseMetric
  }
  opportunities: LighthouseOpportunity[]
  diagnostics:   LighthouseDiagnostic[]
}

export interface LighthouseResult {
  available: boolean
  performanceScore: number        // mobile score (usado en dashboard)
  metrics: LighthouseStrategyData['metrics']
  opportunities: LighthouseOpportunity[]
  diagnostics:   LighthouseDiagnostic[]
  desktop?: LighthouseStrategyData // datos desktop, cargados en paralelo
  error?: string
}

// ─── Sitemap ──────────────────────────────────────────────────────────────────

export interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

export interface SitemapResult {
  found: boolean
  url?: string
  isIndex: boolean
  urlCount: number
  urls: SitemapUrl[]     // muestra hasta 50
  sitemaps?: string[]    // si es sitemap index
  errors: string[]
  warnings: string[]
  checks: Check[]
  score: number
}

// ─── AI Report (Gemini) ───────────────────────────────────────────────────────

export interface AiPriorityAction {
  action: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
}

export interface AiReportSection {
  title: string
  content: string
}

export interface AiReport {
  available: boolean
  summary?: string
  keyFindings?: string[]
  priorityActions?: AiPriorityAction[]
  sections?: AiReportSection[]
  error?: string
}

// ─── Resultado global ─────────────────────────────────────────────────────────

export interface AnalysisResult {
  url: string
  analyzedAt: string // ISO 8601
  globalScore: number
  seo: SeoResult
  performance: PerformanceResult
  lighthouse: LighthouseResult
  sitemap: SitemapResult
  issues: Issue[] // ordenado: critical → warning → info; seo → performance → sitemap
}

// ─── Site Audit ───────────────────────────────────────────────────────────────

export interface PageAuditResult {
  url: string
  status: 'success' | 'error'
  score: number
  seoScore: number
  perfScore: number
  title: string | null
  issueCount: { critical: number; warning: number; info: number }
  issues: Issue[]
  error?: string
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface AnalyzeRequest {
  url: string
}

export type AnalysisErrorCode =
  | 'url_invalid'
  | 'url_unreachable'
  | 'fetch_timeout'
  | 'parse_error'

export interface AnalysisError {
  error: AnalysisErrorCode
  message: string
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ActiveTab = 'dashboard' | 'seo' | 'performance' | 'lighthouse' | 'sitemap' | 'ai-report' | 'issues'
export type SeverityFilter = 'all' | Severity
export type CategoryFilter = 'all' | IssueCategory

export interface AnalysisState {
  status: 'idle' | 'loading' | 'success' | 'error'
  result: AnalysisResult | null
  error: AnalysisError | null
  activeTab: ActiveTab
  severityFilter: SeverityFilter
  categoryFilter: CategoryFilter
}
