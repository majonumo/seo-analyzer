// app/hotels/layout.tsx — layout del dashboard con sidebar multi-hotel

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import {
  Search, Building2, BarChart3, LogOut, Menu, X,
  Globe, Settings, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/hotels',    label: 'Hoteles',    icon: Building2 },
  { href: '/reports',   label: 'Reportes',   icon: BarChart3 },
  { href: '/',          label: 'Audit tool', icon: Globe },
]

function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const router   = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className={cn(
      'flex flex-col bg-zinc-950 border-r border-zinc-800',
      mobile ? 'w-full h-full' : 'w-56 min-h-screen sticky top-0',
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Search className="w-3.5 h-3.5 text-zinc-950" />
        </div>
        <span className="text-sm font-bold tracking-tight text-zinc-100">Hotel Intelligence</span>
        {mobile && onClose && (
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/hotels'
            ? pathname === '/hotels' || pathname.startsWith('/hotels/')
            : pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-zinc-600" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-zinc-800 space-y-0.5">
        <Link href="/settings" onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors">
          <Settings className="w-4 h-4" /> Configuración
        </Link>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

export default function HotelsLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-zinc-950">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-56 h-full">
            <Sidebar mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <button onClick={() => setMobileOpen(true)} className="text-zinc-500 hover:text-zinc-300">
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
            <Search className="w-3 h-3 text-zinc-950" />
          </div>
          <span className="text-sm font-bold text-zinc-100">Hotel Intelligence</span>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
