// app/api/hotels/[id]/deltas/route.ts — GET: últimos deltas de un hotel

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr
  const { data, error } = await supabase
    .from('deltas')
    .select('id, type, description, previous_value, current_value, impact, created_at')
    .eq('hotel_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
