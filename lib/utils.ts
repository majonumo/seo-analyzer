// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Trunca un string a maxLength chars con ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 1) + '…'
}

/** Formatea bytes a KB legible */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

/** Extrae el dominio de una URL */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Normaliza una URL (agrega https:// si no tiene protocolo) */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Genera el nombre del archivo para exportar */
export function getExportFilename(url: string, ext: string): string {
  const domain = getDomain(url).replace(/\./g, '-')
  const date   = new Date().toISOString().slice(0, 10)
  return `seo-report-${domain}-${date}.${ext}`
}
