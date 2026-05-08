// app/api/hotels/[id]/lighthouse/route.ts
// GET  — devuelve el último resultado Lighthouse guardado por estrategia
// POST — corre PageSpeed Insights (mobile + desktop), guarda ambos en DB

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'
import { analyzeLighthouse } from '@/lib/analyzers/lighthouse'

export const maxDuration = 60

type Ctx = { params: { id: string } }

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr
  const strategy = req.nextUrl.searchParams.get('strategy') ?? 'mobile'

  const { data } = await supabase
    .from('lighthouse_results')
    .select('*')
    .eq('hotel_id', params.id)
    .eq('strategy', strategy)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return NextResponse.json(null)

  return NextResponse.json({
    available:        !!data.metrics,
    performanceScore: data.performance_score ?? 0,
    metrics:          data.metrics,
    opportunities:    data.opportunities ?? [],
    diagnostics:      data.diagnostics   ?? [],
    error:            data.error         ?? undefined,
    saved_at:         data.created_at,
    strategy:         data.strategy,
  })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr

  // Obtener URL del hotel
  const { data: hotel } = await supabase
    .from('hotels')
    .select('url')
    .eq('id', params.id)
    .single()

  if (!hotel?.url) {
    return NextResponse.json({ available: false, error: 'Hotel sin URL configurada' }, { status: 400 })
  }

  // analyzeLighthouse corre mobile + desktop en paralelo internamente
  const result = await analyzeLighthouse(hotel.url)

  // Preparar rows para ambas estrategias
  const savedAt = new Date().toISOString()
  const rows = [
    {
      hotel_id:          params.id,
      strategy:          'mobile',
      performance_score: result.available ? result.performanceScore : null,
      metrics:           result.available ? result.metrics          : null,
      opportunities:     result.available ? result.opportunities    : [],
      diagnostics:       result.available ? result.diagnostics      : [],
      error:             result.error ?? null,
    },
    ...(result.available && result.desktop ? [{
      hotel_id:          params.id,
      strategy:          'desktop',
      performance_score: result.desktop.performanceScore,
      metrics:           result.desktop.metrics,
      opportunities:     result.desktop.opportunities ?? [],
      diagnostics:       result.desktop.diagnostics   ?? [],
      error:             null,
    }] : []),
  ]

  const { error: insertErr } = await supabase
    .from('lighthouse_results')
    .insert(rows)

  if (insertErr) console.error('[lighthouse] Error guardando:', insertErr.message)

  return NextResponse.json({
    ...result,
    saved_at: savedAt,
    saved:    !insertErr,
  })
}
