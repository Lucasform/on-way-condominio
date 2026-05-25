import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchCurrentPerfil } from '../lib/auth'
import type { Perfil } from '../types/database'

interface AuthContextValue {
  user: User | null
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  refreshPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadPerfil(userId: string | null) {
    if (!userId) {
      setPerfil(null)
      return
    }
    try {
      const p = await fetchCurrentPerfil(userId)
      setPerfil(p)
    } catch {
      setPerfil(null)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadPerfil(data.session?.user.id ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!mounted) return
      setSession(sess)
      await loadPerfil(sess?.user.id ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    perfil,
    loading,
    refreshPerfil: () => loadPerfil(session?.user.id ?? null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
