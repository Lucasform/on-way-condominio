import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { Role } from '../types/database'

interface Props {
  children: ReactNode
  roles?: Role[]
}

// Janela curta antes de redirecionar pra /login quando perdemos `user`.
// Cobre o caso de refresh de token em andamento (SIGNED_OUT transitório).
const REDIRECT_GRACE_MS = 1500

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, perfil, loading } = useAuth()
  const location = useLocation()

  // Se tínhamos `user` há pouco e agora não temos, esperamos a janela de graça
  // antes de mandar pra /login. Evita "logout" visual em refresh de token.
  const sawUserRef = useRef(false)
  const [graceExpired, setGraceExpired] = useState(false)

  useEffect(() => {
    if (user) {
      sawUserRef.current = true
      setGraceExpired(false)
      return
    }
    if (!sawUserRef.current) {
      // Nunca tivemos user nessa montagem; nada a esperar
      setGraceExpired(true)
      return
    }
    // Tivemos user e ele sumiu — janela de graça
    const t = setTimeout(() => setGraceExpired(true), REDIRECT_GRACE_MS)
    return () => clearTimeout(t)
  }, [user])

  if (loading) {
    return <FullscreenLoader text="Carregando..." />
  }

  if (!user) {
    if (!graceExpired) {
      return <FullscreenLoader text="Validando sessão..." />
    }
    return <Navigate to="/entrar" replace state={{ from: location }} />
  }

  if (!perfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 transition-colors">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Conta sem perfil</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
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

function FullscreenLoader({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50/40 dark:bg-slate-950 text-slate-500 dark:text-slate-400 transition-colors">
      <div className="flex items-center gap-3 text-sm">
        <span className="inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        {text}
      </div>
    </div>
  )
}
