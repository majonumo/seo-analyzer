// app/api/hotels/[id]/keywords/sync/route.ts — POST: sincroniza keywords desde GSC

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { syncGSCKeywords } from '@/lib/gsc/client'

type Ctx = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Ctx) {
  // Verificar credenciales GSC
  if (!process.env.GOOGLE_GSC_CLIENT_EMAIL || !process.env.GOOGLE_GSC_PRIVATE_KEY) {
    return NextResponse.json({
      error: 'GSC no configurado',
      setup: 'Agregar GOOGLE_GSC_CLIENT_EMAIL y GOOGLE_GSC_PRIVATE_KEY al .env.local',
    }, { status: 400 })
  }

  // Obtener gsc_property del hotel
  const supabase = createSupabaseServerClient()
  const { data: hotel, error: hErr } = await supabase
    .from('hotels')
    .select('gsc_property, name')
    .eq('id', params.id)
    .single()

  if (hErr || !hotel) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 })
  if (!hotel.gsc_property) {
    return NextResponse.json({
      error: 'Este hotel no tiene una propiedad de GSC configurada',
      setup: 'Editar el hotel y agregar la URL de la propiedad GSC',
    }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const days = parseInt(body.days ?? '90')

  try {
    const rows = await syncGSCKeywords(params.id, hotel.gsc_property, days)

    // Upsert keywords (evitar duplicados por unique constraint)
    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('keywords')
        .upsert(rows, { onConflict: 'hotel_id,keyword,date,country,device' })

      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ synced: rows.length, days })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
