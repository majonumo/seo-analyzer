// lib/gsc/client.ts — Google Search Console API client

import { google } from 'googleapis'

interface GSCRow {
  hotel_id:    string
  keyword:     string
  position:    number
  clicks:      number
  impressions: number
  ctr:         number
  date:        string
  country:     string | null
  device:      'desktop' | 'mobile' | 'tablet' | null
}

export async function syncGSCKeywords(
  hotelId: string,
  gscProperty: string,
  days = 90,
): Promise<GSCRow[]> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_GSC_CLIENT_EMAIL,
    key:   (process.env.GOOGLE_GSC_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })

  const webmasters = google.webmasters({ version: 'v3', auth })

  const endDate   = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const { data } = await webmasters.searchanalytics.query({
    siteUrl: gscProperty,
    requestBody: {
      startDate:  fmt(startDate),
      endDate:    fmt(endDate),
      dimensions: ['query', 'date', 'country', 'device'],
      rowLimit:   5000,
    },
  })

  if (!data.rows) return []

  return data.rows.map(row => {
    const [keyword, date, country, device] = row.keys ?? []
    const deviceMapped = device === 'DESKTOP' ? 'desktop'
      : device === 'MOBILE' ? 'mobile'
      : device === 'TABLET' ? 'tablet'
      : null

    return {
      hotel_id:    hotelId,
      keyword:     keyword ?? '',
      position:    Math.round((row.position ?? 0) * 100) / 100,
      clicks:      row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr:         Math.round((row.ctr ?? 0) * 10000) / 10000,
      date:        date ?? fmt(new Date()),
      country:     country?.toLowerCase() ?? null,
      device:      deviceMapped,
    }
  })
}
