// lib/supabase.ts — cliente Supabase singleton (browser / API routes sin cookies)

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('[Supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
}

export const supabase = createClient(url ?? '', key ?? '')

// ─── Tipos — tabla projects (legado, sigue en uso) ───────────────────────────

export interface ProjectRow {
  id:                 string
  created_at:         string
  domain:             string
  avg_score:          number
  avg_seo:            number
  avg_perf:           number
  total_pages:        number
  completed_at:       string
  sitemap_url:        string | null
  audit_urls:         string[]
  nav_urls:           string[]
  results:            import('./types').PageAuditResult[]
  lighthouse_results: import('./types').LighthouseResult[]
}

// ─── Tipos — Hotel Intelligence Platform ─────────────────────────────────────

export type Country  = 'mx' | 'us' | 'fr'
export type Language = 'es' | 'en' | 'fr'
export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed'
export type Severity = 'critical' | 'high' | 'low'
export type DeltaImpact = 'positive' | 'negative' | 'neutral'
export type Platform = 'booking' | 'expedia' | 'direct' | 'other'
export type ReportType = 'market_analysis' | 'competitor_intel' | 'ota_strategy' | 'due_diligence' | 'content_strategy' | 'monthly_news'
export type DeviceType = 'desktop' | 'mobile' | 'tablet'

export interface Hotel {
  id:           string
  name:         string
  url:          string
  country:      Country
  destination:  string
  language:     Language
  gsc_property: string | null
  active:       boolean
  created_at:   string
  updated_at:   string
}

export interface Competitor {
  id:         string
  hotel_id:   string
  name:       string
  url:        string
  platform:   Platform
  active:     boolean
  created_at: string
}

export interface Audit {
  id:              string
  hotel_id:        string
  status:          AuditStatus
  score:           number | null
  pages_crawled:   number
  issues_critical: number
  issues_high:     number
  issues_low:      number
  triggered_by:    'manual' | 'scheduled'
  started_at:      string | null
  completed_at:    string | null
  created_at:      string
}

export interface AuditIssue {
  id:             string
  audit_id:       string
  hotel_id:       string
  type:           string
  severity:       Severity
  url:            string
  description:    string | null
  recommendation: string | null
  current_value:  string | null
  expected_value: string | null
  fixed:          boolean
  fixed_at:       string | null
  created_at:     string
}

export interface Delta {
  id:             string
  hotel_id:       string
  audit_id:       string
  prev_audit_id:  string | null
  type:           string
  description:    string
  previous_value: string | null
  current_value:  string | null
  impact:         DeltaImpact | null
  created_at:     string
}

export interface Keyword {
  id:          string
  hotel_id:    string
  keyword:     string
  position:    number | null
  clicks:      number
  impressions: number
  ctr:         number | null
  date:        string
  country:     string | null
  device:      DeviceType | null
  created_at:  string
}

export interface ResearchReport {
  id:          string
  hotel_id:    string | null
  destination: string | null
  type:        ReportType
  title:       string
  content:     string
  sources:     { url: string; title: string; date?: string }[]
  created_at:  string
}
