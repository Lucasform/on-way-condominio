import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../lib/auth'
import AuthShell from '../components/AuthShell'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Vamos enviar um link no seu e-mail pra definir uma nova senha."
      footer={
        <Link to="/login" className="text-brand-700 dark:text-brand-400 font-medium hover:underline">
          ← Voltar pro login
        </Link>
      }
    >
      {sent ? (
        <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-md px-4 py-3">
          ✓ Se houver conta com esse e-mail, enviamos o link de recuperação. Cheque sua caixa de entrada (e spam).
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
              className="w-full px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm"
            />
          </label>

          {error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-md bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
