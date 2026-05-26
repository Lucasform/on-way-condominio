import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { signUp, signInWithGoogle } from '../lib/auth'
import { useAuth } from '../components/AuthProvider'
import AuthShell from '../components/AuthShell'

const inputCls =
  'w-full px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 ' +
  'text-slate-900 dark:text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm'

const primaryBtn =
  'w-full py-2 rounded-md bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold text-sm transition disabled:opacity-50'

export default function Signup() {
  const { user, loading } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-slate-950 text-slate-500">Carregando...</div>
  }
  if (user && !sent) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Senha precisa ter no mínimo 6 caracteres.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signUp({ email, password, nome })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Em ~1 minuto você está dentro."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="text-brand-700 dark:text-brand-400 font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-3">
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-md px-4 py-3">
            ✓ Conta criada! Enviamos um e-mail de confirmação pra <strong>{email}</strong>. Clica no link pra ativar.
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Lembre-se de pedir pra administradora associar seu perfil ao condomínio depois.
          </p>
          <Link to="/login" className="block text-center mt-3 text-sm text-brand-700 dark:text-brand-400 hover:underline">
            Ir pra tela de login
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</span>
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha</span>
              <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <span className="text-xs text-slate-500 mt-1 block">Mín 6 caracteres.</span>
            </label>

            {error && (
              <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className={primaryBtn}>
              {submitting ? 'Criando...' : 'Criar conta'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-600">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            ou
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={() => signInWithGoogle().catch((e) => setError(e.message))}
            className="w-full py-2 rounded-md bg-white border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-100 text-slate-900 font-medium text-sm transition flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Criar com Google
          </button>
        </>
      )}
    </AuthShell>
  )
}
