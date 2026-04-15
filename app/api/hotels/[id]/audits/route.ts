// app/api/hotels/[id]/audits/route.ts — historial de auditorías de un hotel

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('audits')
    .select('id, status, score, pages_crawled, issues_critical, issues_high, issues_low, triggered_by, started_at, completed_at, created_at')
    .eq('hotel_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
