// app/api/hotels/[id]/keywords/route.ts — GET keywords (con filtros)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') // 'quickwins' | 'top' | null (all)
  const days = parseInt(searchParams.get('days') ?? '90')

  const supabase = createSupabaseServerClient()
  let query = supabase
    .from('keywords')
    .select('id, keyword, position, clicks, impressions, ctr, date, country, device')
    .eq('hotel_id', params.id)
    .order('impressions', { ascending: false })
    .limit(500)

  // Date filter
  const since = new Date()
  since.setDate(since.getDate() - days)
  query = query.gte('date', since.toISOString().split('T')[0])

  // Quick wins: position 6-20, impressions > 50, ctr < 3%
  if (mode === 'quickwins') {
    query = query
      .gte('position', 5)
      .lte('position', 20)
      .gt('impressions', 50)
      .lt('ctr', 0.03)
      .order('impressions', { ascending: false })
  }

  // Top performers: top 20 by clicks
  if (mode === 'top') {
    query = query.order('clicks', { ascending: false }).limit(20)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
