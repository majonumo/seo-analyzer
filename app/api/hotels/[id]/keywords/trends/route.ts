// app/api/hotels/[id]/keywords/trends/route.ts
// GET  → trends cacheados del mes actual + quick wins cruzados con GSC
// POST → genera seeds automáticos por nicho/destino, fetcha Google Trends, cruza con GSC

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'
import { fetchTrends } from '@/lib/google-trends'

export const maxDuration = 300

type Ctx = { params: { id: string } }

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Seeds fijos de Google Trends
const FIXED_SEEDS = ['Playa del Carmen', 'Riviera maya', 'All inclusive']

// Geo por país
const COUNTRY_GEO: Record<string, string> = { mx: 'MX', us: 'US', fr: 'FR' }

// ── Quick wins: cruzar rising trends con keywords GSC ─────────────────────────

interface QuickWin {
  trend_query:     string
  trend_value:     string | number
  seed_keyword:    string
  gsc_keyword?:    string
  gsc_position?:   number
  gsc_impressions?: number
  gsc_ctr?:        number
  action:          'optimize' | 'create'
}

function wordsOf(s: string): string[] {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
}

function overlap(a: string, b: string): number {
  const wa = wordsOf(a)
  const wb = new Set(wordsOf(b))
  return wa.filter(w => wb.has(w)).length
}

function buildQuickWins(
  trendRows: { keyword: string; rising: { query: string; value: string | number }[] }[],
  gscKeywords: { keyword: string; position: number; impressions: number; ctr: number }[],
): QuickWin[] {
  // Quick wins de GSC: pos 6-20, >50 impresiones, CTR <3%
  const gscWins = gscKeywords.filter(
    k => k.position >= 6 && k.position <= 20 && k.impressions > 50 && k.ctr < 0.03
  )

  const wins: QuickWin[] = []
  const seen = new Set<string>()

  for (const trend of trendRows) {
    for (const rq of (trend.rising ?? []).slice(0, 10)) {
      if (seen.has(rq.query)) continue
      seen.add(rq.query)

      // Buscar keyword de GSC con mayor solapamiento de palabras
      let bestMatch: typeof gscWins[0] | null = null
      let bestScore = 0

      for (const gsc of gscWins) {
        const score = overlap(rq.query, gsc.keyword)
        if (score > bestScore) { bestScore = score; bestMatch = gsc }
      }

      wins.push({
        trend_query:     rq.query,
        trend_value:     rq.value,
        seed_keyword:    trend.keyword,
        gsc_keyword:     bestMatch?.keyword,
        gsc_position:    bestMatch ? Math.round(bestMatch.position * 10) / 10 : undefined,
        gsc_impressions: bestMatch?.impressions,
        gsc_ctr:         bestMatch?.ctr,
        action:          bestMatch && bestScore >= 1 ? 'optimize' : 'create',
      })
    }
  }

  // Priorizar: optimize primero, luego por impresiones GSC desc
  return wins
    .sort((a, b) => {
      if (a.action !== b.action) return a.action === 'optimize' ? -1 : 1
      return (b.gsc_impressions ?? 0) - (a.gsc_impressions ?? 0)
    })
    .slice(0, 30)
}

// ── DELETE — eliminar un trend por id ────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr
  const id = req.nextUrl.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase
    .from('keyword_trends')
    .delete()
    .eq('id', id)
    .eq('hotel_id', params.id)   // seguridad: solo del hotel correcto

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr
  const month = currentMonth()

  const [trendsRes, gscRes] = await Promise.all([
    supabase
      .from('keyword_trends')
      .select('*')
      .eq('hotel_id', params.id)
      .eq('month', month)
      .order('updated_at', { ascending: false }),
    supabase
      .from('keywords')
      .select('keyword, position, impressions, ctr')
      .eq('hotel_id', params.id)
      .gte('position', 6)
      .lte('position', 20)
      .gt('impressions', 50)
      .lt('ctr', 0.03)
      .order('impressions', { ascending: false })
      .limit(200),
  ])

  const trends = trendsRes.data ?? []
  const gsc    = gscRes.data   ?? []

  const quickWins = buildQuickWins(
    trends.map(t => ({ keyword: t.keyword, rising: t.rising ?? [] })),
    gsc,
  )

  return NextResponse.json({ trends, quick_wins: quickWins, month })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr

  const { data: hotel } = await supabase
    .from('hotels')
    .select('country')
    .eq('id', params.id)
    .single()

  const geo   = COUNTRY_GEO[hotel?.country?.toLowerCase() ?? 'mx'] ?? 'MX'
  const seeds = FIXED_SEEDS
  const month    = currentMonth()

  // Fetch Google Trends para los seeds de nicho
  let results
  try {
    results = await fetchTrends(seeds, geo, 4000)
  } catch (e) {
    return NextResponse.json(
      { error: `Google Trends falló: ${(e as Error).message}` },
      { status: 500 }
    )
  }

  // Upsert en keyword_trends
  const rows = results.map(r => ({
    hotel_id:   params.id,
    keyword:    r.keyword,
    geo:        r.geo,
    month,
    interest:   r.interest,
    rising:     r.rising,
    top:        r.top,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertErr } = await supabase
    .from('keyword_trends')
    .upsert(rows, { onConflict: 'hotel_id,keyword,month,geo' })

  if (upsertErr) {
    console.error('[trends] upsert error:', upsertErr)
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  // Cargar keywords GSC para cruzar
  const { data: gsc } = await supabase
    .from('keywords')
    .select('keyword, position, impressions, ctr')
    .eq('hotel_id', params.id)
    .gte('position', 6)
    .lte('position', 20)
    .gt('impressions', 50)
    .lt('ctr', 0.03)
    .order('impressions', { ascending: false })
    .limit(200)

  const quickWins = buildQuickWins(
    results.map(r => ({ keyword: r.keyword, rising: r.rising })),
    gsc ?? [],
  )

  return NextResponse.json({
    ok:           true,
    month,
    seeds,
    geo,
    trends_saved: rows.length,
    quick_wins:   quickWins,
  })
}
