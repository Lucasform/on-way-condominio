import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { supabase } from '../lib/supabase'
import type { Role } from '../types/database'

interface Props {
  children: ReactNode
  roles?: Role[]
}

// Janela curta antes de redirecionar quando perdemos `user` (refresh transitório).
const REDIRECT_GRACE_MS = 1500

// Janela para aguardar perfil carregar do banco após SIGNED_IN event.
// Evita signOut prematuro quando user chega antes do perfil.
const PERFIL_GRACE_MS = 3000

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, perfil, effectiveRole, loading } = useAuth()
  const location = useLocation()

  // Grace period para user transitoriamente null (token refresh)
  const sawUserRef = useRef(false)
  const [graceExpired, setGraceExpired] = useState(false)

  // Grace period para perfil: após SIGNED_IN, perfil carrega async
  const [perfilGraceExpired, setPerfilGraceExpired] = useState(false)
  const perfilTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (user) {
      sawUserRef.current = true
      setGraceExpired(false)
      return
    }
    if (!sawUserRef.current) {
      setGraceExpired(true)
      return
    }
    const t = setTimeout(() => setGraceExpired(true), REDIRECT_GRACE_MS)
    return () => clearTimeout(t)
  }, [user])

  useEffect(() => {
    if (perfil) {
      // Perfil chegou — cancela qualquer timer pendente
      if (perfilTimerRef.current) {
        clearTimeout(perfilTimerRef.current)
        perfilTimerRef.current = null
      }
      setPerfilGraceExpired(false)
      return
    }
    if (!user) {
      // Sem user, não precisamos esperar perfil
      setPerfilGraceExpired(true)
      return
    }
    // Tem user mas não tem perfil: inicia timer de graça
    perfilTimerRef.current = setTimeout(() => setPerfilGraceExpired(true), PERFIL_GRACE_MS)
    return () => {
      if (perfilTimerRef.current) clearTimeout(perfilTimerRef.current)
    }
  }, [user, perfil])

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
    if (!perfilGraceExpired) {
      return <FullscreenLoader text="Carregando perfil..." />
    }
    // Perfil genuinamente ausente após grace period
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
