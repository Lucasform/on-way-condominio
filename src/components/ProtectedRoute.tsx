import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { supabase } from '../lib/supabase'
import type { Role } from '../types/database'

interface Props {
  children: ReactNode
  roles?: Role[]
}

// Janela curta antes de redirecionar pra /login quando perdemos `user`.
// Cobre o caso de refresh de token em andamento (SIGNED_OUT transitório).
const REDIRECT_GRACE_MS = 1500

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, perfil, effectiveRole, loading } = useAuth()
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
    const fallback = location.pathname === '/' ? '/landing' : '/entrar'
    return <Navigate to={fallback} replace state={{ from: location }} />
  }

  if (!perfil) {
    // Usuário autenticado mas sem perfil no banco: faz signOut para limpar
    // sessão e cache antes de redirecionar — evita loop infinito.
    void supabase.auth.signOut()
    return <Navigate to="/entrar" replace />
  }

  if (roles && !roles.includes(effectiveRole ?? perfil.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function FullscreenLoader({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 transition-colors">
      <div className="flex items-center gap-3 text-sm">
        <span className="inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        {text}
      </div>
    </div>
  )
}
