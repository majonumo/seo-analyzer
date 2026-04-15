// app/api/hotels/[id]/research/[reportId]/route.ts — GET/DELETE reporte individual

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { id: string; reportId: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('research_reports')
    .select('*')
    .eq('id', params.reportId)
    .eq('hotel_id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('research_reports')
    .delete()
    .eq('id', params.reportId)
    .eq('hotel_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
