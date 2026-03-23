// lib/supabase.ts — cliente Supabase singleton

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  // No lanzamos error en build time, solo en runtime si falta
  console.warn('[Supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
}

export const supabase = createClient(
  url ?? '',
  key ?? '',
)

// ─── Tipos de DB ──────────────────────────────────────────────────────────────

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
