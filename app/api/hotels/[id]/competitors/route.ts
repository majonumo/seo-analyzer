// app/api/hotels/[id]/competitors/route.ts — GET/POST competitors

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Platform } from '@/lib/supabase'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('hotel_id', params.id)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  let body: { name: string; url: string; platform: Platform }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { name, url, platform } = body
  if (!name || !url || !platform) {
    return NextResponse.json({ error: 'Faltan campos: name, url, platform' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('competitors')
    .insert({ hotel_id: params.id, name, url, platform })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
