'use client'
// components/hotel/HotelTabNav.tsx — navegación de tabs del hotel

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Overview',       path: '',             exact: true },
  { label: 'Auditoría',      path: '/audit' },
  { label: 'Keywords',       path: '/keywords' },
  { label: 'Competidores',   path: '/competitors' },
  { label: 'Investigación',  path: '/research' },
  { label: 'Configuración',  path: '/settings' },
]

interface Props {
  hotelId:   string
  hotelName: string
  hotelUrl:  string
  country:   string
}

const FLAGS: Record<string, string> = { mx: '🇲🇽', us: '🇺🇸', fr: '🇫🇷' }

export function HotelTabNav({ hotelId, hotelName, hotelUrl, country }: Props) {
  const pathname = usePathname()
  const base     = `/hotels/${hotelId}`

  return (
    <div className="mb-7">
      {/* Hotel header */}
      <div className="flex items-start gap-3 mb-5">
        <Link href="/hotels" className="text-zinc-500 hover:text-zinc-300 transition-colors mt-1 flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-lg">{FLAGS[country] ?? '🏨'}</span>
            <h1 className="text-xl font-bold text-zinc-100 truncate">{hotelName}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-zinc-600" />
            <a href={hotelUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors truncate">
              {hotelUrl}
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-zinc-800">
        {TABS.map(({ label, path, exact }) => {
          const href    = `${base}${path}`
          const active  = exact ? pathname === href : pathname.startsWith(href) && path !== ''
          const isExact = exact && pathname === href
          const finalActive = exact ? isExact : active

          return (
            <Link
              key={path}
              href={href}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                finalActive
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700',
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
