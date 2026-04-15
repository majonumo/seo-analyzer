// app/api/hotels/stats/route.ts — GET: métricas globales del dashboard

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()

  const [hotelsRes, auditsRes, issuesRes, deltasRes] = await Promise.all([
    // Hoteles activos
    supabase.from('hotels').select('id, name, country', { count: 'exact' }).eq('active', true),

    // Auditorías este mes
    supabase.from('audits')
      .select('id, score, hotel_id, completed_at', { count: 'exact' })
      .eq('status', 'completed')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

    // Issues críticos pendientes (sin resolver)
    supabase.from('issues')
      .select('id', { count: 'exact' })
      .eq('severity', 'critical')
      .eq('fixed', false),

    // Últimos 5 deltas de todos los hoteles
    supabase.from('deltas')
      .select('id, type, description, impact, created_at, hotel_id, hotels(name, country)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return NextResponse.json({
    hotelsActive:       hotelsRes.count ?? 0,
    auditsThisMonth:    auditsRes.count ?? 0,
    criticalIssues:     issuesRes.count ?? 0,
    recentDeltas:       deltasRes.data ?? [],
  })
}
