// app/api/hotels/[id]/research/route.ts — GET/POST reportes de investigación

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ReportType } from '@/lib/supabase'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('research_reports')
    .select('id, type, title, destination, created_at')
    .eq('hotel_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  let body: { type: ReportType; title: string; content: string; destination?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { type, title, content, destination } = body
  if (!type || !title || !content) {
    return NextResponse.json({ error: 'Faltan campos: type, title, content' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('research_reports')
    .insert({ hotel_id: params.id, type, title, content, destination: destination ?? null })
    .select('id, type, title, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
