import { redirect } from 'next/navigation'

// La raíz redirige siempre al dashboard.
// El middleware se encarga de redirigir al login si no hay sesión.
export default function RootPage() {
  redirect('/hotels')
}
