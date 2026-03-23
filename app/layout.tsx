// app/layout.tsx
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'SEO Analyzer — Diagnóstico rápido de SEO y performance',
  description:
    'Analizá cualquier URL y obtené un diagnóstico completo de SEO on-page y performance en segundos. Scores, issues accionables y exportación de reportes.',
  openGraph: {
    title: 'SEO Analyzer',
    description: 'Diagnóstico rápido de SEO y performance para cualquier URL.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
