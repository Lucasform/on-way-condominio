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

const AUTH_LOAD_TIMEOUT_MS = 8000
const PERFIL_CACHE_KEY = 'onway:perfil_cache'

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout em ${label} após ${ms}ms`)), ms)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

function readCache(userId: string): Perfil | null {
  try {
    const raw = localStorage.getItem(PERFIL_CACHE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw) as { user_id: string; perfil: Perfil }
    if (obj.user_id !== userId) return null
    return obj.perfil
  } catch { return null }
}

function writeCache(userId: string, perfil: Perfil | null) {
  try {
    if (!perfil) { localStorage.removeItem(PERFIL_CACHE_KEY); return }
    localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify({ user_id: userId, perfil }))
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [hardError, setHardError] = useState<string | null>(null)

  async function loadPerfil(userId: string | null, useCache = true) {
    if (!userId) { setPerfil(null); writeCache('', null); return }
    // Cache hit: renderiza imediato; refresh em background
    if (useCache) {
      const cached = readCache(userId)
      if (cached) setPerfil(cached)
    }
    try {
      const p = await withTimeout(fetchCurrentPerfil(userId), AUTH_LOAD_TIMEOUT_MS, 'fetchCurrentPerfil')
      setPerfil(p)
      writeCache(userId, p)
    } catch (e) {
      console.error('[AuthProvider] loadPerfil falhou:', e)
      // Mantém cache se houver — não derruba a sessão
    }
  }

  useEffect(() => {
    let mounted = true
    let watchdog: ReturnType<typeof setTimeout> | null = null

    watchdog = setTimeout(() => {
      if (!mounted) return
      console.warn('[AuthProvider] Watchdog disparou')
      setHardError('Tempo esgotado carregando sessão.')
      setLoading(false)
    }, AUTH_LOAD_TIMEOUT_MS + 2000)

    ;(async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), AUTH_LOAD_TIMEOUT_MS, 'getSession')
        if (!mounted) return
        setSession(data.session)
        await loadPerfil(data.session?.user.id ?? null)
      } catch (e) {
        console.error('[AuthProvider] getSession falhou:', e)
        if (mounted) setHardError(e instanceof Error ? e.message : 'Erro de sessão.')
      } finally {
        if (mounted) {
          if (watchdog) clearTimeout(watchdog)
          setLoading(false)
        }
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (!mounted) return
      setSession(sess)
      // Só re-busca perfil em eventos significativos. TOKEN_REFRESHED não muda perfil.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        await loadPerfil(sess?.user.id ?? null, event !== 'SIGNED_OUT')
      }
    })

    return () => {
      mounted = false
      if (watchdog) clearTimeout(watchdog)
      sub.subscription.unsubscribe()
    }
  }, [])

  if (hardError && loading === false) {
    return <RecoveryScreen message={hardError} />
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    perfil,
    loading,
    refreshPerfil: () => loadPerfil(session?.user.id ?? null, false),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function RecoveryScreen({ message }: { message: string }) {
  // Mensagem técnica vai pro console; usuário vê algo amigável.
  console.warn('[RecoveryScreen]', message)
  async function limparTudo() {
    try {
      await supabase.auth.signOut().catch(() => {})
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') || k.includes('supabase') || k.startsWith('onway:')) localStorage.removeItem(k)
      })
      sessionStorage.clear()
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } finally {
      window.location.replace('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-slate-950 p-6">
      <div className="max-w-sm text-center">
        <div className="text-5xl mb-4">🤔</div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Não conseguimos te conectar
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Pode ser uma instabilidade momentânea. Tente recarregar — se persistir, faça login de novo.
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
          >
            Recarregar
          </button>
          <button
            onClick={limparTudo}
            className="px-5 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium"
          >
            Fazer login de novo
          </button>
        </div>
      </div>
    </div>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
