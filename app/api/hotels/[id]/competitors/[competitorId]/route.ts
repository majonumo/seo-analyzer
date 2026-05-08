// app/api/hotels/[id]/competitors/[competitorId]/route.ts — DELETE competitor

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

type Ctx = { params: { id: string; competitorId: string } }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr
  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', params.competitorId)
    .eq('hotel_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
