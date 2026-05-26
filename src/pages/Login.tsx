import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  signInWithPassword,
  signInWithMagicLink,
  signInWithGoogle,
} from '../lib/auth'
import { useAuth } from '../components/AuthProvider'
import AuthShell from '../components/AuthShell'

type Modo = 'senha' | 'magic'

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
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
        navigate('/', { replace: true })
      } else {
        await signInWithMagicLink(email)
        setMagicSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    try {
      await signInWithGoogle()
      // O navegador é redirecionado pra Google.
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
          Não tem conta?{' '}
          <Link to="/signup" className="text-emerald-400 hover:underline">
            Criar agora
          </Link>
        </>
      }
    >
      {/* Toggle senha / magic link */}
      <div className="flex bg-slate-800/60 rounded-md p-1 mb-5">
        <button
          type="button"
          onClick={() => { setModo('senha'); setError(null); setMagicSent(false) }}
          className={`flex-1 text-sm py-1.5 rounded transition ${
            modo === 'senha' ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
        >
          Senha
        </button>
        <button
          type="button"
          onClick={() => { setModo('magic'); setError(null) }}
          className={`flex-1 text-sm py-1.5 rounded transition ${
            modo === 'magic' ? 'bg-slate-700 text-white' : 'text-slate-400'
          }`}
        >
          Link mágico
        </button>
      </div>

      {magicSent ? (
        <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-4 py-3">
          ✓ Link de acesso enviado pra <strong>{email}</strong>. Cheque sua caixa de entrada e clique no link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-300 mb-1">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </label>

          {modo === 'senha' && (
            <label className="block">
              <span className="flex items-center justify-between text-sm font-medium text-slate-300 mb-1">
                Senha
                <Link to="/esqueci-senha" className="text-xs text-slate-500 hover:text-emerald-400">
                  Esqueci
                </Link>
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
              />
            </label>
          )}

          {modo === 'magic' && (
            <p className="text-xs text-slate-500">
              Sem senha. Você vai receber um e-mail com link de acesso direto.
            </p>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition disabled:opacity-50"
          >
            {submitting
              ? 'Entrando...'
              : modo === 'senha'
              ? 'Entrar'
              : 'Enviar link mágico'}
          </button>
        </form>
      )}

      {/* Divisor + Google */}
      <div className="my-5 flex items-center gap-3 text-xs text-slate-600">
        <div className="flex-1 h-px bg-slate-800" />
        ou
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full py-2 rounded-md bg-white hover:bg-slate-100 text-slate-900 font-medium text-sm transition flex items-center justify-center gap-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continuar com Google
      </button>
    </AuthShell>
  )
}
