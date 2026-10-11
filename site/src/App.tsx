// Aiguillage : /admin affiche l'espace organisateurs, tout le reste affiche le site public.
import { lazy, Suspense } from 'react'
import { route } from './base'
import PublicSite from './public/PublicSite'

const Admin = lazy(() => import('./admin/Admin'))

export default function App() {
  if (route() === '/admin')
    return (
      <Suspense fallback={null}>
        <Admin />
      </Suspense>
    )
  return <PublicSite />
}
