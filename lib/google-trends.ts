// lib/google-trends.ts
// Cliente TypeScript que replica lo que hace pytrends internamente.
// Llama a la API interna (no oficial) de Google Trends sin API key.

const GT_BASE = 'https://trends.google.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export interface TrendPoint   { date: string; value: number }
export interface RelatedQuery { query: string; value: number | string }

export interface TrendsResult {
  keyword:  string
  geo:      string
  month:    string          // 'YYYY-MM' del snapshot
  interest: TrendPoint[]   // 0-100 por mes (12 puntos)
  rising:   RelatedQuery[] // keywords que están subiendo rápido
  top:      RelatedQuery[] // keywords más buscadas relacionadas
}

// Google wraps all Trends API responses with a security prefix ending in \n
// The prefix varies (")]}',\n" on some endpoints, ")]}\n" on others).
// Strip everything up to and including the first newline when the text isn't
// already valid JSON (i.e., doesn't start with { or [).
function strip(text: string): string {
  if (text.startsWith('{') || text.startsWith('[')) return text
  const nl = text.indexOf('\n')
  return nl !== -1 ? text.slice(nl + 1).trimStart() : text
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Paso 1: obtener cookie de sesión ─────────────────────────────────────────

async function getSessionCookie(): Promise<string> {
  const res = await fetch(`${GT_BASE}/trends/explore`, {
    headers: {
      'User-Agent':      UA,
      'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })

  // Node 18+ tiene getSetCookie(); en versiones anteriores usamos get()
  const raw: string[] = typeof (res.headers as unknown as Record<string, unknown>).getSetCookie === 'function'
    ? (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
    : [res.headers.get('set-cookie') ?? '']

  const cookie = raw
    .flatMap(c => c.split(','))
    .map(c => c.split(';')[0].trim())
    .filter(c => c.includes('=') && c.length > 0)
    .join('; ')

  return cookie
}

// ── Paso 2: obtener tokens de widgets ─────────────────────────────────────────

interface Widget {
  id:      string
  token:   string
  request: Record<string, unknown>
}

async function getWidgets(
  keyword: string,
  geo:     string,
  cookie:  string,
): Promise<Widget[]> {
  const req = JSON.stringify({
    comparisonItem: [{ keyword, geo, time: 'today 12-m' }],
    category: 0,
    property: '',
  })

  const url = `${GT_BASE}/trends/api/explore?hl=es&tz=0&req=${encodeURIComponent(req)}`

  const res = await fetch(url, {
    headers: {
      'User-Agent':      UA,
      'Accept-Language': 'es-MX,es;q=0.9',
      'Cookie':          cookie,
      'Referer':         `${GT_BASE}/trends/explore`,
    },
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) throw new Error(`Explore API HTTP ${res.status}`)

  const data = JSON.parse(strip(await res.text()))
  return (data.widgets ?? []) as Widget[]
}

// ── Paso 3: interés a lo largo del tiempo ────────────────────────────────────

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
    if (res.status !== 429) return res
    // 429 — esperar con backoff exponencial antes de reintentar
    const wait = 4000 * (i + 1)   // 4s, 8s, 12s
    console.warn(`[google-trends] 429 en intento ${i + 1}, esperando ${wait}ms…`)
    await new Promise(r => setTimeout(r, wait))
  }
  throw new Error('Multiline API HTTP 429 (agotados los reintentos)')
}

async function getInterest(widget: Widget, cookie: string): Promise<TrendPoint[]> {
  const url = `${GT_BASE}/trends/api/widgetdata/multiline`
    + `?hl=es&tz=0`
    + `&req=${encodeURIComponent(JSON.stringify(widget.request))}`
    + `&token=${encodeURIComponent(widget.token)}`

  const res = await fetchWithRetry(url, {
    'User-Agent': UA,
    'Cookie':     cookie,
    'Referer':    `${GT_BASE}/trends/explore`,
  })

  if (!res.ok) throw new Error(`Multiline API HTTP ${res.status}`)

  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(strip(text))
  } catch (e) {
    console.error('[google-trends] getInterest parse error, raw prefix:', JSON.stringify(text.slice(0, 60)))
    throw new Error(`Multiline parse error: ${(e as Error).message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = ((data as any)?.default?.timelineData ?? []) as Array<{
    formattedTime?: string
    formattedAxisTime?: string
    value?: number[]
    hasData?: boolean[]
  }>

  return raw.map(p => ({
    date:  p.formattedAxisTime ?? p.formattedTime ?? '',
    value: p.value?.[0] ?? 0,
  }))
}

// ── Paso 4: queries relacionadas ─────────────────────────────────────────────

async function getRelatedQueries(
  widget: Widget,
  cookie: string,
): Promise<{ rising: RelatedQuery[]; top: RelatedQuery[] }> {
  const url = `${GT_BASE}/trends/api/widgetdata/relatedsearches`
    + `?hl=es&tz=0`
    + `&req=${encodeURIComponent(JSON.stringify(widget.request))}`
    + `&token=${encodeURIComponent(widget.token)}`

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Cookie': cookie, 'Referer': `${GT_BASE}/trends/explore` },
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) return { rising: [], top: [] }

  const data    = JSON.parse(strip(await res.text()))
  const lists   = (data?.default?.rankedList ?? []) as Array<{
    rankedKeyword: Array<{ query: string; value: number; formattedValue?: string }>
  }>

  const toRQ = (list: typeof lists[0]['rankedKeyword']): RelatedQuery[] =>
    (list ?? []).slice(0, 10).map(r => ({ query: r.query, value: r.formattedValue ?? r.value }))

  return {
    rising: toRQ(lists[0]?.rankedKeyword ?? []),
    top:    toRQ(lists[1]?.rankedKeyword ?? []),
  }
}

// ── Función pública principal ─────────────────────────────────────────────────

export async function fetchTrend(keyword: string, geo = 'MX'): Promise<TrendsResult> {
  const cookie  = await getSessionCookie()
  const widgets = await getWidgets(keyword, geo, cookie)

  const timelineWidget = widgets.find(w => w.id === 'TIMESERIES')
  const relatedWidget  = widgets.find(w => w.id === 'RELATED_QUERIES')

  if (!timelineWidget) throw new Error(`Google Trends no devolvió datos para "${keyword}"`)

  const interest = await getInterest(timelineWidget, cookie)

  const { rising, top } = relatedWidget
    ? await getRelatedQueries(relatedWidget, cookie)
    : { rising: [], top: [] }

  return { keyword, geo, month: currentMonth(), interest, rising, top }
}

// ── Fetch de múltiples keywords con delay entre requests ──────────────────────
// Cada keyword usa su propia sesión (cookie) para evitar throttling por sesión.
// El delay entre keywords da tiempo a que Google no detecte el patrón.

export async function fetchTrends(
  keywords: string[],
  geo = 'MX',
  delayMs = 4000,
): Promise<TrendsResult[]> {
  const results: TrendsResult[] = []
  const kws = keywords.slice(0, 3)

  for (let i = 0; i < kws.length; i++) {
    const kw = kws[i].trim()
    try {
      const result = await fetchTrend(kw, geo)
      results.push(result)
      if (delayMs > 0 && i < kws.length - 1) {
        await new Promise(r => setTimeout(r, delayMs))
      }
    } catch (e) {
      console.error(`[google-trends] Error en "${kw}":`, (e as Error).message)
      results.push({
        keyword: kw, geo, month: '',
        interest: [], rising: [], top: [],
      })
    }
  }

  return results
}
