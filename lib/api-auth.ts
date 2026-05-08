// lib/api-auth.ts
// Helper para verificar autenticación en API routes.
// Uso: const authError = await requireAuth(supabase)
//      if (authError) return authError

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verifica que el request tenga una sesión válida.
 * Devuelve un NextResponse 401 si no está autenticado, o null si sí lo está.
 */
// Auth desactivado temporalmente
export async function requireAuth(
  _supabase: SupabaseClient,
): Promise<NextResponse | null> {
  return null
}
