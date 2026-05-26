import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { consumeLogoutIntent, fetchCurrentPerfil } from '../lib/auth'
import type { Perfil } from '../types/database'

interface AuthContextValue {
  user: User | null
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  refreshPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// getSession é local (lê localStorage do supabase-js) — deveria ser instantâneo.
// fetchCurrentPerfil vai pro Postgres — pode demorar; rodamos em background quando há cache.
const SESSION_LOAD_TIMEOUT_MS = 4000
const PERFIL_FETCH_TIMEOUT_MS = 8000
// Janela pra confirmar SIGNED_OUT que vem do supabase-js. Se for transitório
// (refresh fail seguido de SIGNED_IN), evitamos derrubar o app pra /login.
const SIGNOUT_CONFIRM_DELAY_MS = 1500
const PERFIL_CACHE_KEY = 'onway:perfil_cache'

interface PerfilCacheEntry {
  user_id: string
  perfil: Perfil
  ts: number
}

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
    const obj = JSON.parse(raw) as PerfilCacheEntry
    if (obj.user_id !== userId) return null
    return obj.perfil
  } catch { return null }
}

function writeCache(userId: string, perfil: Perfil | null) {
  try {
    if (!perfil) { localStorage.removeItem(PERFIL_CACHE_KEY); return }
    const entry: PerfilCacheEntry = { user_id: userId, perfil, ts: Date.now() }
    localStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(entry))
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  // hardError reservado pra erros realmente irrecuperáveis. Hoje não temos
  // caminho que dispare — `RecoveryScreen` segue acessível via `limparTudo`
  // se o supabase-js eventualmente travar de forma irrecuperável.
  const [hardError] = useState<string | null>(null)

  // Confirmação adiada de SIGNED_OUT: se for refresh transitório, ignoramos.
  const pendingSignOutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadPerfil(userId: string | null, useCache = true) {
    if (!userId) { setPerfil(null); writeCache('', null); return }
    // Cache hit: renderiza imediato; refresh em background
    if (useCache) {
      const cached = readCache(userId)
      if (cached) setPerfil(cached)
    }
    try {
      const p = await withTimeout(fetchCurrentPerfil(userId), PERFIL_FETCH_TIMEOUT_MS, 'fetchCurrentPerfil')
      setPerfil(p)
      writeCache(userId, p)
    } catch (e) {
      console.warn('[AuthProvider] loadPerfil falhou (mantendo cache):', e)
      // Mantém cache se houver — não derruba a sessão
    }
  }

  function cancelPendingSignOut() {
    if (pendingSignOutRef.current) {
      clearTimeout(pendingSignOutRef.current)
      pendingSignOutRef.current = null
    }
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        // 1) Tenta ler sessão local (instantâneo na maioria dos casos)
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_LOAD_TIMEOUT_MS,
          'getSession',
        )
        if (!mounted) return

        const sess = data.session
        setSession(sess)

        // 2) Se tem session, hidrata perfil do cache imediatamente (se houver)
        //    e dispara revalidação em background — sem bloquear o render
        const uid = sess?.user.id ?? null
        if (uid) {
          const cached = readCache(uid)
          if (cached) setPerfil(cached)
          // background revalidate — não bloqueia loading
          void loadPerfil(uid, !cached)
        } else {
          setPerfil(null)
        }
      } catch (e) {
        console.warn('[AuthProvider] getSession lento/falhou:', e)
        // Tenta hidratar do cache mesmo sem session pra evitar tela branca,
        // mas só se houver sb-* token no localStorage (sinal de que tem sessão salva).
        const possivelmenteLogado = Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.includes('auth-token'))
        if (mounted && !possivelmenteLogado) {
          // Sem nada local — segue pro login, sem hard error
          setSession(null)
          setPerfil(null)
        } else if (mounted) {
          // Tem token salvo mas getSession travou — mantemos perfil cacheado se houver
          // e seguimos. supabase-js continuará tentando refresh por baixo.
          console.warn('[AuthProvider] Seguindo com cache; supabase-js cuidará do refresh.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (!mounted) return

      // SIGNED_OUT pode ser transitório (refresh fail entre TOKEN_REFRESHED com sucesso).
      // Damos uma janela curta pra confirmar antes de derrubar o app.
      // Exceção: se o usuário clicou em "Sair" (markLogoutIntent), sai imediato.
      if (event === 'SIGNED_OUT') {
        cancelPendingSignOut()
        if (consumeLogoutIntent()) {
          setSession(null)
          setPerfil(null)
          writeCache('', null)
          return
        }
        pendingSignOutRef.current = setTimeout(async () => {
          const { data } = await supabase.auth.getSession()
          if (!mounted) return
          if (data.session) {
            // Voltou — era transitório. Mantém estado atual.
            console.info('[AuthProvider] SIGNED_OUT transitório ignorado')
            setSession(data.session)
            return
          }
          setSession(null)
          setPerfil(null)
          writeCache('', null)
        }, SIGNOUT_CONFIRM_DELAY_MS)
        return
      }

      // Qualquer outro evento cancela uma confirmação pendente de signout
      cancelPendingSignOut()
      setSession(sess)

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void loadPerfil(sess?.user.id ?? null, event !== 'SIGNED_IN')
      }
      // TOKEN_REFRESHED não muda perfil
    })

    return () => {
      mounted = false
      cancelPendingSignOut()
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
      window.location.replace('/entrar')
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
          Pode ser uma instabilidade momentânea. Faça login novamente.
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
            Fazer login novamente
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
