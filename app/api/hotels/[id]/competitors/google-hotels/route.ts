// app/api/hotels/[id]/competitors/google-hotels/route.ts
// GET:  devuelve el último scan guardado en competitor_prices
// POST: busca precios en Google Hotels via SerpAPI y guarda en competitor_prices

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

export const maxDuration = 30

type Ctx = { params: { id: string } }

// ── GET — reconstruir último scan desde competitor_prices ─────────────────────

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr

  // Traer los registros más recientes con room_type que empiece con 'Google Hotels ·'
  const { data, error } = await supabase
    .from('competitor_prices')
    .select('platform, price_usd, room_type, scraped_at')
    .eq('hotel_id', params.id)
    .like('room_type', 'Google Hotels · %')
    .order('scraped_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json(null)

  // Agrupar por scraped_at para encontrar el lote más reciente
  // (todos los registros de una misma búsqueda tienen el mismo scraped_at)
  const latestTs = data[0].scraped_at
  const batch    = data.filter(r => r.scraped_at === latestTs)

  // Reconstruir el room_type → extraer fechas: 'Google Hotels · 2025-04-17'
  const roomType = batch[0]?.room_type ?? ''
  const checkIn  = roomType.replace('Google Hotels · ', '')

  const platforms = batch.map(r => ({
    source:    r.platform,
    price_usd: r.price_usd,
    sponsored: false,
    room_type: null as string | null,
  }))

  if (platforms.length === 0) return NextResponse.json(null)

  const prices      = platforms.map(p => p.price_usd)
  const minPrice    = Math.min(...prices)
  const maxPrice    = Math.max(...prices)
  const minPlatform = platforms.find(p => p.price_usd === minPrice)!.source
  const maxPlatform = platforms.find(p => p.price_usd === maxPrice)!.source
  const disparityPct = minPrice > 0
    ? Math.round(((maxPrice - minPrice) / minPrice) * 100 * 10) / 10
    : 0

  return NextResponse.json({
    hotel_name:    '',
    check_in:      checkIn,
    check_out:     '',
    platforms,
    min_price:     minPrice,
    max_price:     maxPrice,
    min_platform:  minPlatform,
    max_platform:  maxPlatform,
    disparity_pct: disparityPct,
    has_disparity: disparityPct > 15,
    saved:         batch.length,
    scanned_at:    latestTs,   // campo extra para mostrar "última consulta"
  })
}

interface SerpApiPrice {
  source:         string
  logo?:          string
  rate_per_night: { lowest?: string; extracted_lowest?: number; before_taxes_fees?: string }
  num_guests?:    number
  sponsored?:     boolean
}

interface SerpApiProperty {
  name:           string
  link?:          string
  overall_rating?: number
  reviews?:       number
  rate_per_night?: { lowest?: string; extracted_lowest?: number }
  prices?:        SerpApiPrice[]
}

export interface GoogleHotelsResult {
  hotel_name:    string
  check_in:      string
  check_out:     string
  platforms:     {
    source:      string
    price_usd:   number
    sponsored:   boolean
    room_type:   string | null
  }[]
  min_price:     number
  max_price:     number
  min_platform:  string
  max_platform:  string
  disparity_pct: number
  has_disparity: boolean   // >15%
  saved:         number
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr

  let body: { query?: string; check_in?: string; check_out?: string; competitor_id?: string; debug?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const apiKey = process.env.SERPAPI_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SERPAPI_KEY no configurada. Registrate gratis en serpapi.com y agrega la key a .env.local' },
      { status: 500 }
    )
  }

  // 1. Obtener datos del hotel para autocompletar el query
  const { data: hotel } = await supabase
    .from('hotels')
    .select('name, destination, country')
    .eq('id', params.id)
    .single()

  const searchQuery = body.query || `${hotel?.name ?? ''} ${hotel?.destination ?? ''}`.trim()

  // Fechas por defecto: mañana + pasado mañana
  const tomorrow     = new Date(Date.now() + 86_400_000)
  const dayAfter     = new Date(Date.now() + 2 * 86_400_000)
  const fmt          = (d: Date) => d.toISOString().split('T')[0]
  const checkIn      = body.check_in  ?? fmt(tomorrow)
  const checkOut     = body.check_out ?? fmt(dayAfter)

  // Mapeo de país a gl param de Google
  const GL: Record<string, string> = { mx: 'mx', us: 'us', fr: 'fr' }
  const gl = GL[hotel?.country ?? 'mx'] ?? 'mx'

  // 2. Llamar a SerpAPI
  const serpUrl = new URL('https://serpapi.com/search.json')
  serpUrl.searchParams.set('engine',         'google_hotels')
  serpUrl.searchParams.set('q',              searchQuery)
  serpUrl.searchParams.set('check_in_date',  checkIn)
  serpUrl.searchParams.set('check_out_date', checkOut)
  serpUrl.searchParams.set('currency',       'USD')
  serpUrl.searchParams.set('adults',         '2')
  serpUrl.searchParams.set('gl',             gl)
  serpUrl.searchParams.set('hl',             'es')
  serpUrl.searchParams.set('api_key',        apiKey)

  let properties: SerpApiProperty[] = []
  let rawData: Record<string, unknown> = {}

  try {
    const res = await fetch(serpUrl.toString(), { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `SerpAPI error: ${err}` }, { status: 500 })
    }
    rawData = await res.json()

    if (rawData.error) {
      return NextResponse.json({ error: `SerpAPI: ${rawData.error}` }, { status: 422 })
    }

    // Si se pide debug, devolver la respuesta cruda completa
    if (body.debug) {
      return NextResponse.json({
        debug: true,
        top_level_keys: Object.keys(rawData),
        raw: rawData,
      })
    }

    // SerpAPI tiene dos modos de respuesta:
    // A) Búsqueda de hotel específico → datos en el root (name, prices, rate_per_night...)
    // B) Búsqueda de lista ("Hotels in...") → datos en data.properties[]
    const hasRootPrices = Array.isArray(rawData.prices) && (rawData.prices as unknown[]).length > 0
    const hasPropsList  = Array.isArray(rawData.properties) && (rawData.properties as unknown[]).length > 0

    if (hasRootPrices) {
      // Modo A: hotel específico devuelto directamente en el root
      properties = [rawData as unknown as SerpApiProperty]
    } else if (hasPropsList) {
      // Modo B: lista de hoteles
      properties = rawData.properties as SerpApiProperty[]
    }

  } catch (e) {
    return NextResponse.json({ error: `Error al consultar SerpAPI: ${(e as Error).message}` }, { status: 500 })
  }

  if (properties.length === 0) {
    const availableKeys = Object.keys(rawData)
    return NextResponse.json(
      {
        error: `No se encontraron resultados en Google Hotels para "${searchQuery}".`,
        hint:  availableKeys.length
          ? `La respuesta de SerpAPI contiene: ${availableKeys.join(', ')}`
          : 'SerpAPI devolvió una respuesta vacía.',
        query: searchQuery,
      },
      { status: 422 }
    )
  }

  // 3. Tomar el resultado y procesar sus precios
  const property = properties[0]
  // Intentar prices → featured_prices como fallback
  const rawPrices: SerpApiPrice[] = (
    (Array.isArray(property.prices) && property.prices.length > 0)
      ? property.prices
      : (property as unknown as Record<string, unknown>).featured_prices ?? []
  ) as SerpApiPrice[]

  if (rawPrices.length === 0) {
    return NextResponse.json(
      { error: 'Google Hotels encontró el hotel pero no devolvió precios. Probá con otras fechas o más noches de estancia.' },
      { status: 422 }
    )
  }

  const platforms = rawPrices
    .filter(p => p.rate_per_night?.extracted_lowest)
    .map(p => ({
      source:    p.source,
      price_usd: p.rate_per_night.extracted_lowest!,
      sponsored: p.sponsored ?? false,
      room_type: null as string | null,
    }))

  if (platforms.length === 0) {
    return NextResponse.json({ error: 'No se pudieron extraer precios numéricos.' }, { status: 422 })
  }

  // 4. Calcular disparidad
  const priceValues   = platforms.map(p => p.price_usd)
  const minPrice      = Math.min(...priceValues)
  const maxPrice      = Math.max(...priceValues)
  const minPlatform   = platforms.find(p => p.price_usd === minPrice)!.source
  const maxPlatform   = platforms.find(p => p.price_usd === maxPrice)!.source
  const disparityPct  = minPrice > 0
    ? Math.round(((maxPrice - minPrice) / minPrice) * 100 * 10) / 10
    : 0

  // 5. Guardar en competitor_prices
  // Buscar competidores existentes para asociar por nombre
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, platform')
    .eq('hotel_id', params.id)
    .eq('active', true)

  const now = new Date().toISOString()

  const pricesToInsert = platforms.map(p => {
    // Intentar asociar con competidor existente por nombre de plataforma
    const platformKey = p.source.toLowerCase().replace(/[^a-z]/g, '')
    const matchedComp = body.competitor_id
      ? competitors?.find(c => c.id === body.competitor_id)
      : competitors?.find(c => {
          const compPlatform = c.platform.toLowerCase()
          return platformKey.includes(compPlatform) || compPlatform.includes(platformKey.slice(0, 6))
        })

    return {
      hotel_id:      params.id,
      competitor_id: matchedComp?.id ?? null,
      price_usd:     p.price_usd,
      currency:      'USD',
      room_type:     `Google Hotels · ${checkIn}`,
      platform:      p.source,
      scraped_at:    now,
    }
  })

  const { error: insertErr } = await supabase
    .from('competitor_prices')
    .insert(pricesToInsert)

  if (insertErr) console.error('Error guardando precios:', insertErr)

  const result: GoogleHotelsResult = {
    hotel_name:    (property.name as string) || searchQuery,
    check_in:      checkIn,
    check_out:     checkOut,
    platforms,
    min_price:     minPrice,
    max_price:     maxPrice,
    min_platform:  minPlatform,
    max_platform:  maxPlatform,
    disparity_pct: disparityPct,
    has_disparity: disparityPct > 15,
    saved:         insertErr ? 0 : pricesToInsert.length,
  }

  return NextResponse.json(result)
}
