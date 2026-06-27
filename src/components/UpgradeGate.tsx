import { Link } from 'react-router-dom'
import type { FeatureKey } from '../types/featureFlag'
import { PLANO_CATALOG } from '../types/billing'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'

const FEATURE_LABEL: Record<FeatureKey, string> = {
  portaria:      'Portaria Digital',
  acessos:       'Acessos Autorizados',
  moradores:     'Moradores',
  mural:         'Mural Informativo',
  ocorrencias:   'Ocorrências',
  chat:          'Chat Interno',
  comunicados:   'Comunicados',
  classificados: 'Classificados',
  multas:        'Multas',
  chamados:      'Chamados',
  calendario:    'Calendário',
  assembleias:   'Assembleias',
  servicos:      'Serviços',
  regimento:     'Regimento',
  relatorios:    'Relatórios',
  whatsapp:      'WhatsApp',
  reservas:      'Reservas',
  solicitacoes:  'Solicitações',
  veiculos:      'Veículos',
  pets:          'Pets',
}

interface Props {
  feature: FeatureKey
}

export default function UpgradeGate({ feature }: Props) {
  const { assinatura } = useFeatureFlags()
  const label = FEATURE_LABEL[feature] ?? feature

  // Descobre qual plano desbloqueia essa feature
  const planNecessario = PLANO_CATALOG.find((p) => p.features.includes(feature))
  const isTrial = assinatura?.status === 'trial'
  const isInadimplente = assinatura?.status === 'inadimplente' || assinatura?.status === 'cancelado'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="mb-6 w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
        <LockIcon />
      </div>

      <h2 className="text-xl font-bold text-slate-100 mb-2">
        {isInadimplente ? 'Acesso suspenso' : `${label} não está disponível`}
      </h2>

      {isInadimplente ? (
        <p className="text-slate-400 text-sm max-w-sm mb-8">
          Sua assinatura está suspensa. Regularize o pagamento para retomar o acesso completo.
        </p>
      ) : (
        <p className="text-slate-400 text-sm max-w-sm mb-8">
          {planNecessario
            ? <>Esta funcionalidade está disponível a partir do plano <span className="text-slate-200 font-semibold">{planNecessario.nome}</span> (R$ {planNecessario.preco_mensal}/mês).</>
            : 'Esta funcionalidade não está disponível no seu plano atual.'
          }
          {isTrial && ' Contrate um plano para manter o acesso após o período de teste.'}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/planos"
          className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition"
        >
          Ver planos
        </Link>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition"
        >
          Voltar ao início
        </Link>
      </div>

      {planNecessario && !isInadimplente && (
        <div className="mt-10 max-w-sm w-full rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            {planNecessario.nome} — R$ {planNecessario.preco_mensal}/mês
          </p>
          <ul className="space-y-1.5">
            {planNecessario.features.slice(0, 6).map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-emerald-500 shrink-0">✓</span>
                {FEATURE_LABEL[f] ?? f}
              </li>
            ))}
            {planNecessario.features.length > 6 && (
              <li className="text-xs text-slate-600">+{planNecessario.features.length - 6} funcionalidades</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
