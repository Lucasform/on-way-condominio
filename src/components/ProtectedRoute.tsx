import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { ReactNode } from 'react'
import type { Role } from '../types/database'

interface Props {
  children: ReactNode
  roles?: Role[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, perfil, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Carregando...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!perfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Conta sem perfil</h1>
          <p className="text-slate-400 text-sm">
            Seu usuário não tem perfil associado neste condomínio. Procure a administradora ou o síndico.
          </p>
        </div>
      </div>
    )
  }

  if (roles && !roles.includes(perfil.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
