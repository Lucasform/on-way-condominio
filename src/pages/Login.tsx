import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  signInWithPassword,
  signInWithMagicLink,
  signInWithGoogle,
  GOOGLE_AUTH_ENABLED,
} from '../lib/auth'
import { useAuth } from '../components/AuthProvider'
import AuthShell from '../components/AuthShell'
import { supabase } from '../lib/supabase'

type Modo = 'senha' | 'email'

const inputCls =
  'w-full px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 ' +
  'text-slate-900 dark:text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm'

const primaryBtn =
  'w-full py-2 rounded-md bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold text-sm transition disabled:opacity-50'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()
  const [modo, setModo] = useState<Modo>('senha')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
        Carregando...
      </div>
    )
  }
  if (user) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMagicSent(false)
    try {
      if (modo === 'senha') {
        await signInWithPassword(email, password)
        // Verifica se precisa de 2FA
        const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (mfaData?.currentLevel === 'aal1' && mfaData?.nextLevel === 'aal2') {
          const { data: factors } = await supabase.auth.mfa.listFactors()
          const totp = factors?.totp?.find((f) => f.status === 'verified')
          if (totp) {
            const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
            if (cErr) throw cErr
            setMfa({ factorId: totp.id, challengeId: chal.id })
            setSubmitting(false)
            return
          }
        }
        navigate('/', { replace: true })
      } else {
        await signInWithMagicLink(email)
        setMagicSent(true)
      }
    } catch (err) {
      setError(traduzErroAuth(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault()
    if (!mfa) return
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfa.factorId,
        challengeId: mfa.challengeId,
        code: mfaCode.trim(),
      })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setError(traduzErroAuth(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro com Google')
    }
  }

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse com sua conta do condomínio."
      footer={
        <>
          <div className="text-center">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Morador, primeiro acesso?</div>
            <Link
              to="/signup"
              className="inline-block px-4 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition"
            >
              Criar conta com código de convite →
            </Link>
          </div>
        </>
      }
    >
      {/* Toggle senha / entrar por e-mail */}
      <div className="flex bg-slate-100 dark:bg-slate-800/60 rounded-md p-1 mb-5">
        <button
          type="button"
          onClick={() => { setModo('senha'); setError(null); setMagicSent(false) }}
          className={`flex-1 text-sm py-1.5 rounded transition font-medium ${
            modo === 'senha'
              ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          🔒 Senha
        </button>
        <button
          type="button"
          onClick={() => { setModo('email'); setError(null) }}
          className={`flex-1 text-sm py-1.5 rounded transition font-medium ${
            modo === 'email'
              ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          ✉ Entrar por e-mail
        </button>
      </div>

      {mfa ? (
        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div className="text-center">
            <div className="text-3xl mb-2">🔐</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Digite o código do app autenticador
            </p>
          </div>
          <input
            type="text"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            autoFocus
            className="w-full px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-2xl font-mono tracking-widest"
          />
          {error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <button type="submit" disabled={submitting || mfaCode.length !== 6} className={primaryBtn}>
            {submitting ? 'Verificando...' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => { setMfa(null); setMfaCode(''); setError(null); supabase.auth.signOut() }}
            className="w-full text-xs text-slate-500 hover:underline"
          >
            Cancelar
          </button>
        </form>
      ) : magicSent ? (
        <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-md px-4 py-3">
          ✓ Link de acesso enviado pra <strong>{email}</strong>. Cheque sua caixa de entrada e clique no link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>

          {modo === 'senha' && (
            <label className="block">
              <span className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Senha
                <Link to="/esqueci-senha" className="text-xs text-slate-500 hover:text-brand-700 dark:hover:text-brand-400">
                  Esqueci a senha
                </Link>
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </label>
          )}

          {modo === 'email' && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sem senha. Vamos enviar um link de acesso direto pro seu e-mail.
            </p>
          )}

          {error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className={primaryBtn}>
            {submitting
              ? 'Aguarde...'
              : modo === 'senha'
              ? 'Entrar'
              : 'Enviar link de acesso'}
          </button>
        </form>
      )}

      {GOOGLE_AUTH_ENABLED && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-600">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            ou
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full py-2 rounded-md bg-white border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-100 text-slate-900 font-medium text-sm transition flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continuar com Google
          </button>
        </>
      )}
    </AuthShell>
  )
}

function traduzErroAuth(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const msg = raw.toLowerCase()
  if (msg.includes('signups not allowed')) {
    return 'Esse e-mail ainda não tem conta. Peça pra sua administradora ou síndico te convidar.'
  }
  if (msg.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Veja sua caixa de entrada.'
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos.'
  }
  if (msg.includes('unsupported provider')) {
    return 'Esse método de login ainda não está disponível.'
  }
  return raw
}
