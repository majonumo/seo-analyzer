// app/api/audit/start/route.ts — POST: crea registro de auditoría en Supabase

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  let body: { hotelId: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { hotelId } = body
  if (!hotelId) return NextResponse.json({ error: 'hotelId requerido' }, { status: 400 })

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('audits')
    .insert({
      hotel_id:     hotelId,
      status:       'running',
      triggered_by: 'manual',
      started_at:   new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ auditId: data.id }, { status: 201 })
}
