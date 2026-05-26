import { Link, Navigate, useLocation } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { useAuth } from '../components/AuthProvider'

interface Opcao {
  to: string
  emoji: string
  titulo: string
  descricao: string
  destaque?: boolean
}

export default function EscolhaPerfil() {
  const { user, loading } = useAuth()
  const location = useLocation()

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

  // Repassa o `from` adiante: preserva o deep-link se o usuário tinha aberto uma URL específica
  const passState = location.state ?? undefined

  const opcoes: Opcao[] = [
    {
      to: '/login?tipo=admin',
      emoji: '🛠',
      titulo: 'Administração',
      descricao: 'Síndico, administradora, portaria ou ronda.',
    },
    {
      to: '/login?tipo=morador',
      emoji: '🏠',
      titulo: 'Morador',
      descricao: 'Acesso à sua unidade, multas, encomendas e mural.',
      destaque: true,
    },
    {
      to: '/prestador',
      emoji: '🔧',
      titulo: 'Prestador',
      descricao: 'Manutenção, limpeza e outros serviços.',
    },
  ]

  return (
    <AuthShell
      title="Quem está entrando?"
      subtitle="Escolha o tipo de acesso pra continuar."
    >
      <div className="space-y-3">
        {opcoes.map((o) => (
          <Link
            key={o.to}
            to={o.to}
            state={passState}
            className={`group flex items-center gap-4 px-4 py-4 rounded-lg border transition ${
              o.destaque
                ? 'border-brand-500/40 bg-brand-50 dark:bg-brand-700/10 hover:border-brand-600 dark:hover:border-brand-400'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-brand-500 dark:hover:border-brand-500/60'
            }`}
          >
            <div className="w-12 h-12 shrink-0 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl">
              {o.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{o.titulo}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{o.descricao}</div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition shrink-0">
              →
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
        Ainda não tem cadastro? Peça à administração do seu condomínio um código de convite.
      </p>
    </AuthShell>
  )
}
