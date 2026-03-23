// app/result/page.tsx
// Redirige a la home (el análisis ahora ocurre en la página principal).
import { redirect } from 'next/navigation'
export default function ResultPage() {
  redirect('/')
}
