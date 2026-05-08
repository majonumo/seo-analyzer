// app/api/hotels/[id]/competitors/discover/route.ts
// POST: usa Gemini para identificar los 5 competidores más cercanos con precios estimados

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

export const maxDuration = 55

type Ctx = { params: { id: string } }

interface GeminiCompetitor {
  name:              string
  website_url:       string
  booking_url:       string | null
  platform:          'booking' | 'expedia' | 'direct' | 'other'
  reason:            string
  avg_price_usd:     number | null   // precio medio estimado por noche en USD
  price_notes:       string | null   // ej: "temporada alta $250, baja $150"
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr

  // 1. Obtener datos del hotel
  const { data: hotel, error: hotelErr } = await supabase
    .from('hotels')
    .select('name, url, destination, country, language')
    .eq('id', params.id)
    .single()

  if (hotelErr || !hotel) {
    return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 })
  }

  const countryNames: Record<string, string> = { mx: 'México', us: 'Estados Unidos', fr: 'Francia' }
  const countryName = countryNames[hotel.country] ?? hotel.country

  // 2. Prompt con instrucción de incluir precios
  const prompt = `Eres un experto en inteligencia competitiva hotelera con acceso a datos de mercado.

Hotel a analizar:
- Nombre: ${hotel.name}
- Destino: ${hotel.destination}
- País: ${countryName}
- Website: ${hotel.url}

Tu tarea: identificar los 5 hoteles competidores más directos en ${hotel.destination}, ${countryName}.

Criterios de selección:
1. Misma zona geográfica (${hotel.destination})
2. Categoría similar (boutique, lujo, resort — inferido del nombre/URL del hotel analizado)
3. Rango de precio competitivo (no incluir hoteles de 3 estrellas si el hotel analizado es de lujo)
4. Presencia en Booking.com o sitio directo conocido
5. NO incluir Airbnb ni hostales

Para cada competidor devuelve estos campos exactos:
- name: nombre del hotel
- website_url: URL del sitio web directo (dominio propio, sin Booking.com)
- booking_url: URL exacta en Booking.com (formato https://www.booking.com/hotel/[pais]/[slug].html) o null si no la conoces con certeza
- platform: "booking" si tiene perfil en Booking.com, "direct" si solo web propia, "other" si otro
- reason: 1 frase breve (máximo 12 palabras) por qué compite directamente
- avg_price_usd: precio promedio estimado por noche en USD (número entero, temporada media). Basate en tu conocimiento del mercado hotelero en ${hotel.destination}. Si no tienes certeza, usa null
- price_notes: nota breve sobre el rango de precios (ej: "Desde $180 en temporada baja, hasta $450 en alta") o null

IMPORTANTE: Devuelve ÚNICAMENTE un array JSON válido. Sin markdown, sin texto adicional, solo el JSON.
Formato exacto:
[{"name":"...","website_url":"...","booking_url":"...","platform":"booking","reason":"...","avg_price_usd":220,"price_notes":"Desde $180 en baja temporada"},...]`

  // 3. Llamar a Gemini
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })

  let competitors: GeminiCompetitor[] = []

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(45_000),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Extraer JSON (Gemini a veces envuelve en ```json ... ```)
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Gemini no devolvió JSON válido')

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) throw new Error('Respuesta no es un array')

    competitors = parsed.slice(0, 5).filter((c: GeminiCompetitor) =>
      c.name && c.website_url && c.platform
    )
  } catch (e) {
    return NextResponse.json({ error: `Error al procesar respuesta de Gemini: ${(e as Error).message}` }, { status: 500 })
  }

  if (competitors.length === 0) {
    return NextResponse.json({ error: 'Gemini no encontró competidores para este hotel' }, { status: 422 })
  }

  // 4. Guardar competidores en DB (ignorar duplicados por URL)
  const { data: existing } = await supabase
    .from('competitors')
    .select('id, url')
    .eq('hotel_id', params.id)

  const existingUrls = new Set((existing ?? []).map(c => c.url))

  const toInsert = competitors
    .filter(c => !existingUrls.has(c.booking_url ?? '') && !existingUrls.has(c.website_url))
    .map(c => ({
      hotel_id: params.id,
      name:     c.name,
      url:      c.booking_url ?? c.website_url,
      platform: c.platform,
      active:   true,
    }))

  let saved: { id: string; url: string; name: string }[] = []
  if (toInsert.length > 0) {
    const { data, error: insertErr } = await supabase
      .from('competitors')
      .insert(toInsert)
      .select('id, url, name')

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    saved = data ?? []
  }

  // 5. Guardar precios estimados de Gemini para los competidores nuevos
  const now = new Date().toISOString()
  const pricesToInsert = saved
    .map(savedComp => {
      const geminiComp = competitors.find(c =>
        (c.booking_url ?? c.website_url) === savedComp.url || c.name === savedComp.name
      )
      if (!geminiComp?.avg_price_usd) return null
      return {
        hotel_id:      params.id,
        competitor_id: savedComp.id,
        price_usd:     geminiComp.avg_price_usd,
        currency:      'USD',
        room_type:     'Estimado IA',
        platform:      'booking',
        scraped_at:    now,
      }
    })
    .filter(Boolean)

  if (pricesToInsert.length > 0) {
    await supabase.from('competitor_prices').insert(pricesToInsert)
  }

  return NextResponse.json({
    discovered:     competitors.length,
    saved:          saved.length,
    skipped:        competitors.length - toInsert.length,
    prices_saved:   pricesToInsert.length,
    all_discovered: competitors,
  })
}
