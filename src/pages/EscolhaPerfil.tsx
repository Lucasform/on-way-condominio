import { Link, Navigate, useLocation } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { useAuth } from '../components/AuthProvider'
import { useTenant } from '../components/TenantProvider'

interface Opcao {
  to: string
  emoji: string
  titulo: string
  descricao: string
}

export default function EscolhaPerfil() {
  const { user, loading } = useAuth()
  const { brand } = useTenant()
  const location = useLocation()

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

  // Repassa o `from` adiante: preserva o deep-link se o usuário tinha aberto uma URL específica
  const passState = location.state ?? undefined

  const opcoes: Opcao[] = [
    {
      to: '/login?tipo=admin',
      emoji: '🛡',
      titulo: 'Administração',
      descricao: 'Síndico, subsíndico, conselheiro, portaria ou ronda.',
    },
    {
      to: '/login?tipo=morador',
      emoji: '🏠',
      titulo: 'Morador',
      descricao: 'Acesso à sua unidade, multas, encomendas e mural.',
    },
  ]

  const title = brand ? `Bem-vindo a ${brand.nome}` : 'Quem está entrando?'
  const subtitle = brand?.mensagem_boas_vindas ?? 'Escolha o tipo de acesso pra continuar.'

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {brand?.logo_url && (
        <div className="flex justify-center mb-4">
          <img
            src={brand.logo_url}
            alt={brand.nome}
            className="max-h-20 w-auto"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {opcoes.map((o) => (
          <Link
            key={o.to}
            to={o.to}
            state={passState}
            className="group flex flex-col items-center text-center px-4 py-6 rounded-lg border border-slate-800 bg-slate-900/40 transition outline-none hover:border-brand-500 hover:bg-brand-700/10 hover:shadow-md focus-visible:border-brand-500 focus-visible:bg-brand-700/10 focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 group-hover:border-brand-500 group-focus-visible:border-brand-500 flex items-center justify-center text-3xl mb-3 transition">
              {o.emoji}
            </div>
            <div className="font-semibold text-slate-100">{o.titulo}</div>
            <div className="mt-1 text-xs text-slate-400 leading-relaxed">
              {o.descricao}
            </div>
          </Link>
        ))}
      </div>

      {(brand?.permite_signup ?? true) && (
        <div className="mt-6 text-center text-xs text-slate-500 space-y-1">
          <div>Ainda não tem cadastro?</div>
          <div>Peça à administração do seu condomínio um código de convite.</div>
        </div>
      )}

      {!brand && (
        <div className="mt-6 flex justify-end">
          <Link
            to="/login?tipo=admin_onway"
            className="text-[10px] text-slate-600 hover:text-slate-300 transition tracking-wide"
            title="Acesso interno OnWay"
          >
            · admin do app
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
