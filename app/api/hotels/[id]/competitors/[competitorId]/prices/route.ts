// app/api/hotels/[id]/competitors/[competitorId]/prices/route.ts — GET/POST precios OTA

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { id: string; competitorId: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('competitor_prices')
    .select('*')
    .eq('competitor_id', params.competitorId)
    .eq('hotel_id', params.id)
    .order('scraped_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  let body: {
    price_usd: number
    price_local?: number
    currency?: string
    room_type?: string
    check_in?: string
    check_out?: string
    platform: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.price_usd || !body.platform) {
    return NextResponse.json({ error: 'Faltan campos: price_usd, platform' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('competitor_prices')
    .insert({
      hotel_id:      params.id,
      competitor_id: params.competitorId,
      price_usd:     body.price_usd,
      price_local:   body.price_local ?? null,
      currency:      body.currency ?? 'USD',
      room_type:     body.room_type ?? null,
      check_in:      body.check_in ?? null,
      check_out:     body.check_out ?? null,
      platform:      body.platform,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
