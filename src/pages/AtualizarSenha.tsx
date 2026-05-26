import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updatePassword } from '../lib/auth'
import { useAuth } from '../components/AuthProvider'
import AuthShell from '../components/AuthShell'

export default function AtualizarSenha() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (novaSenha.length < 6) return setError('Mín 6 caracteres.')
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
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">Carregando...</div>
  }
  // Se não tem session, o link expirou ou veio direto
  if (!user) {
    return (
      <AuthShell title="Link inválido">
        <p className="text-sm text-slate-400">
          O link de recuperação expirou ou já foi usado.{' '}
          <Link to="/esqueci-senha" className="text-emerald-400 hover:underline">
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
            minLength={6}
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">Confirmar</span>
          <input
            type="password"
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm"
          />
        </label>

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
          {submitting ? 'Salvando...' : 'Salvar e entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
