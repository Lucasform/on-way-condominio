import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { redeemInviteCode } from '../lib/convites'
import { useAuth } from '../components/AuthProvider'
import AuthShell from '../components/AuthShell'
import { validatePassword, PASSWORD_HINT } from '../lib/passwordPolicy'

const inputCls =
  'w-full px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 ' +
  'text-slate-900 dark:text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm'

const primaryBtn =
  'w-full py-2 rounded-md bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold text-sm transition disabled:opacity-50'

export default function Signup() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-50 dark:bg-slate-950 text-slate-500">Carregando...</div>
  }
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = validatePassword(password)
    if (!v.ok) {
      setError('Senha fraca: ' + v.errors.join(', ') + '.')
      return
    }
    if (!aceitouTermos) {
      setError('Você precisa aceitar os termos de uso e a política de privacidade.')
      return
    }
    setSubmitting(true)
    setError(null)
    const r = await redeemInviteCode({ email, password, nome, codigo })
    setSubmitting(false)
    if (!r.ok) {
      setError(r.error ?? 'Erro ao criar conta.')
      return
    }
    // Sessão já foi configurada dentro do redeemInviteCode; AuthProvider detecta e leva pra home
    navigate('/', { replace: true })
  }

  return (
    <AuthShell
      title="Primeiro acesso do morador"
      subtitle="Use o código de convite que sua administradora ou síndico enviou."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login?tipo=morador" className="text-brand-700 dark:text-brand-400 font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código de convite</span>
          <input
            type="text"
            required
            autoComplete="off"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\s+/g, '').toUpperCase())}
            placeholder="EX: FLAMBOYANT2026"
            className={`${inputCls} tracking-wider uppercase`}
          />
          <span className="text-xs text-slate-500 mt-1 block">
            Não tem código? Peça pra sua administradora ou síndico.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome completo</span>
          <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          <span className="text-xs text-slate-500 mt-1 block">{PASSWORD_HINT}</span>
        </label>

        <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={aceitouTermos}
            onChange={(e) => setAceitouTermos(e.target.checked)}
            className="mt-0.5 accent-brand-700"
          />
          <span>
            Li e aceito os{' '}
            <Link to="/termos" target="_blank" className="text-brand-700 dark:text-brand-400 hover:underline">
              termos de uso
            </Link>{' '}
            e a{' '}
            <Link to="/privacidade" target="_blank" className="text-brand-700 dark:text-brand-400 hover:underline">
              política de privacidade
            </Link>.
          </span>
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
    </AuthShell>
  )
}
