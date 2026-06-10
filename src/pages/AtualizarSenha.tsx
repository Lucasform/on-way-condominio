import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updatePassword } from '../lib/auth'
import { useAuth } from '../components/AuthProvider'
import AuthShell from '../components/AuthShell'
import { validatePassword, PASSWORD_HINT } from '../lib/passwordPolicy'

const inputCls =
  'w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 ' +
  'text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm'

const primaryBtn =
  'w-full py-2 rounded-md bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold text-sm transition disabled:opacity-50'

export default function AtualizarSenha() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = validatePassword(novaSenha)
    if (!v.ok) return setError('Senha fraca: ' + v.errors.join(', ') + '.')
    if (novaSenha !== confirmar) return setError('As senhas não batem.')

    setSubmitting(true)
    setError(null)
    try {
      await updatePassword(novaSenha)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-500">Carregando...</div>
  }
  if (!user) {
    return (
      <AuthShell title="Link inválido">
        <p className="text-sm text-slate-400">
          O link de recuperação expirou ou já foi usado.{' '}
          <Link to="/esqueci-senha" className="text-brand-400 font-medium hover:underline">
            Solicitar um novo
          </Link>.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Definir nova senha" subtitle="Escolha uma senha forte. Depois você está dentro.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">Nova senha</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className={inputCls}
          />
          <span className="text-xs text-slate-500 mt-1 block">{PASSWORD_HINT}</span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">Confirmar</span>
          <input
            type="password"
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className={inputCls}
          />
        </label>

        {error && (
          <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className={primaryBtn}>
          {submitting ? 'Salvando...' : 'Salvar e entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
