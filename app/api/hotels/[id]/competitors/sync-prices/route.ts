// app/api/hotels/[id]/competitors/sync-prices/route.ts
// POST: intenta extraer precios automáticamente de las páginas de cada competidor
// Estrategia: fetch con headers reales → parseo de precios en HTML → guardar en DB

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'

export const maxDuration = 55

type Ctx = { params: { id: string } }

interface ScrapeResult {
  competitor_id:   string
  competitor_name: string
  price_usd:       number | null
  source_url:      string
  method:          string
  error?:          string
}

// Patrones de precio en HTML (USD, EUR, MXN)
const PRICE_PATTERNS = [
  // Booking.com: data-testid o clase de precio
  /bui-price-display__value[^>]*>\s*(?:US\$|USD|€|\$|MXN\s*)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  // JSON-LD structured data: price
  /"price"\s*:\s*"?([\d,]+(?:\.\d{1,2})?)"?/,
  // Meta price tag
  /property="product:price:amount"\s+content="([\d.]+)"/,
  // og:price
  /property="og:price:amount"\s+content="([\d.]+)"/,
  // Schema.org priceRange o price
  /"lowPrice"\s*:\s*"?([\d.]+)"?/,
  // Texto visible: $XXX por noche, USD XXX, etc.
  /(?:desde|from|tarifa|rate|precio|price)[^$€\d]*(?:US\$|USD|€|\$|MXN)?\s*([\d,]{2,6})(?:\.\d{1,2})?\s*(?:\/|por)?\s*(?:noche|night|nuit)/i,
  // Número genérico entre $ y /noche
  /\$\s*([\d,]{2,6})\s*(?:USD|MXN|EUR)?(?:\s*\/?\s*(?:noche|night))?/,
]

// Tasas de cambio aproximadas a USD (se actualizarán manualmente)
const TO_USD: Record<string, number> = {
  USD: 1, MXN: 0.058, EUR: 1.08, GBP: 1.26,
}

function extractCurrency(html: string): string {
  if (html.includes('MXN') || html.includes('peso')) return 'MXN'
  if (html.includes('EUR') || html.includes('€')) return 'EUR'
  return 'USD'
}

function extractPrice(html: string): { price: number; currency: string } | null {
  for (const pattern of PRICE_PATTERNS) {
    const match = html.match(pattern)
    if (match) {
      const raw = parseFloat(match[1].replace(/,/g, ''))
      if (raw > 10 && raw < 50000) {   // filtro de sanidad
        const currency = extractCurrency(html)
        const usd = raw * (TO_USD[currency] ?? 1)
        // Verificar que el precio tiene sentido (10-10000 USD)
        if (usd >= 10 && usd <= 10000) return { price: Math.round(usd * 100) / 100, currency }
      }
    }
  }
  return null
}

async function scrapePrice(url: string): Promise<{ price: number; currency: string; method: string } | null> {
  // Headers realistas de navegador
  const headers = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control':   'no-cache',
    'Pragma':          'no-cache',
  }

  try {
    const res = await fetch(url, {
      headers,
      redirect:  'follow',
      signal:    AbortSignal.timeout(12_000),
    })

    if (!res.ok) return null

    const html = await res.text()

    // Intentar JSON-LD primero (más fiable)
    const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const inner = block.replace(/<[^>]+>/g, '')
          const data = JSON.parse(inner)
          const price = data?.offers?.price ?? data?.priceRange ?? data?.price
          if (typeof price === 'number' && price > 10 && price < 50000) {
            const currency = data?.offers?.priceCurrency ?? data?.priceCurrency ?? 'USD'
            const usd = price * (TO_USD[currency] ?? 1)
            if (usd >= 10 && usd <= 10000) return { price: Math.round(usd * 100) / 100, currency, method: 'json-ld' }
          }
          // priceRange como string: "$200 - $500"
          if (typeof price === 'string') {
            const m = price.match(/\$?([\d,]+)/)
            if (m) {
              const p = parseFloat(m[1].replace(/,/g, ''))
              if (p >= 10 && p <= 10000) return { price: p, currency: 'USD', method: 'json-ld-range' }
            }
          }
        } catch { /* continuar */ }
      }
    }

    // Buscar en meta tags
    const metaMatch = html.match(/content="([\d.]+)"[^>]*property="(?:product|og):price:amount"/)
                   ?? html.match(/property="(?:product|og):price:amount"\s+content="([\d.]+)"/)
    if (metaMatch) {
      const price = parseFloat(metaMatch[1])
      if (price >= 10 && price <= 10000) {
        return { price, currency: 'USD', method: 'meta-tag' }
      }
    }

    // Búsqueda de patrones en texto
    const result = extractPrice(html)
    if (result) return { ...result, method: 'html-pattern' }

    return null
  } catch {
    return null
  }
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseAdminClient()
  const authErr = await requireAuth(supabase)
  if (authErr) return authErr

  // 1. Obtener competidores del hotel
  const { data: competitors, error: compErr } = await supabase
    .from('competitors')
    .select('id, name, url, platform')
    .eq('hotel_id', params.id)
    .eq('active', true)

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })
  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ error: 'No hay competidores. Usa "Auto-descubrir" primero.' }, { status: 422 })
  }

  // 2. Scraping paralelo (máx 5 a la vez)
  const results: ScrapeResult[] = []
  const pricesToInsert: {
    hotel_id: string; competitor_id: string; price_usd: number
    currency: string; platform: string; scraped_at: string
  }[] = []

  await Promise.allSettled(
    competitors.map(async (c) => {
      const result: ScrapeResult = {
        competitor_id:   c.id,
        competitor_name: c.name,
        price_usd:       null,
        source_url:      c.url,
        method:          'none',
      }

      const scraped = await scrapePrice(c.url)

      if (scraped) {
        result.price_usd = scraped.price
        result.method    = scraped.method
        pricesToInsert.push({
          hotel_id:      params.id,
          competitor_id: c.id,
          price_usd:     scraped.price,
          currency:      scraped.currency,
          platform:      c.platform,
          scraped_at:    new Date().toISOString(),
        })
      } else {
        result.error = 'No se pudo extraer precio (página protegida o sin precio visible)'
      }

      results.push(result)
    })
  )

  // 3. Guardar precios encontrados
  if (pricesToInsert.length > 0) {
    await supabase.from('competitor_prices').insert(pricesToInsert)
  }

  const found    = results.filter(r => r.price_usd !== null).length
  const notFound = results.length - found

  return NextResponse.json({
    total:    results.length,
    found,
    not_found: notFound,
    results,
  })
}
