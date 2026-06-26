import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../lib/auth'
import AuthShell from '../components/AuthShell'
import Button from '../components/ui/Button'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
    } catch (err) {
      // Never expose whether the email exists — always show success.
      console.warn('[EsqueciSenha]', err)
    } finally {
      setSent(true)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Vamos enviar um link no seu e-mail pra definir uma nova senha."
      footer={
        <Link to="/entrar" className="text-brand-400 font-medium hover:underline">
          ← Voltar pra tela inicial
        </Link>
      }
    >
      {sent ? (
        <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-md px-4 py-3 space-y-2">
          <p className="font-medium">✓ Tudo certo!</p>
          <p>Se existe uma conta com esse e-mail, você vai receber um link pra criar uma nova senha em alguns minutos.</p>
          <p className="text-emerald-600 dark:text-emerald-400">Não esqueça de conferir a caixa de spam.</p>
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
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm"
            />
          </label>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
