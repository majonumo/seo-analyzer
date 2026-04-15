// app/api/reports/route.ts — GET: todos los deltas de todos los hoteles

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('deltas')
    .select('id, type, description, previous_value, current_value, impact, created_at, hotel_id, hotels(name, country)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
