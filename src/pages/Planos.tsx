import { useState } from 'react'
import { withRetry } from '../lib/retry'
import { PLANO_CATALOG } from '../types/billing'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import type { FeatureKey } from '../types/featureFlag'
import PageHeader from '../components/ui/PageHeader'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'

const FEATURE_LABEL: Record<FeatureKey, string> = {
  portaria:     'Serviços de Portaria',
  acessos:      'Acessos Autorizados',
  moradores:    'Moradores',
  mural:        'Mural Informativo',
  ocorrencias:  'Ocorrências',
  chat:         'Chat Interno',
  comunicados:  'Comunicados',
  classificados:'Classificados',
  multas:       'Multas',
  chamados:     'Chamados',
  calendario:   'Calendário',
  assembleias:  'Assembleias e Votações',
  servicos:     'Prestação de Serviços',
  regimento:    'Regimento Interno',
  relatorios:   'Relatórios',
  whatsapp:     'WhatsApp',
  reservas:     'Reserva de Espaços',
  solicitacoes: 'Solicitações',
  veiculos:     'Veículos',
  pets:         'Pets',
}

const ROLES_PERMITIDOS = ['admin_onway', 'parceiro', 'administradora', 'sindico', 'subsindico']

export default function Planos() {
  const { perfil } = useAuth()
  if (perfil && !ROLES_PERMITIDOS.includes(perfil.role)) return <Navigate to="/" replace />

  const { assinatura } = useFeatureFlags()
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)

  // Só admin e parceiro podem iniciar checkout diretamente
  const podeContratar = perfil && ['admin_onway', 'parceiro'].includes(perfil.role)

  const planoAtual = assinatura?.plano_id ?? null
  const emTrial = !assinatura || assinatura.status === 'trial'

  async function handleContratar(planoId: string) {
    if (!podeContratar) return
    setLoadingPlano(planoId)
    setCheckoutError(null)
    try {
      const origin = window.location.origin
      const { data, error } = await withRetry(
        () => supabase.functions.invoke('create-checkout-session', {
          body: {
            plano_id: planoId,
            success_url: `${origin}/checkout/sucesso`,
            cancel_url: `${origin}/planos`,
          },
        }),
        { attempts: 2, baseDelayMs: 800 }
      )
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('URL de checkout não retornada.')
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Erro ao iniciar checkout.')
    } finally {
      setLoadingPlano(null)
    }
  }

  const planos = PLANO_CATALOG.filter((p) => p.id !== 'custom')

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Planos"
        subtitle="Escolha o plano ideal para o seu condomínio. Sem taxa de instalação, cancele quando quiser."
      />

      {checkoutError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{checkoutError}</span>
        </div>
      )}

      {emTrial && assinatura?.trial_ends_at && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Período de teste gratuito até{' '}
          <strong>{new Date(assinatura.trial_ends_at).toLocaleDateString('pt-BR')}</strong>.{' '}
          Escolha um plano antes do vencimento para manter o acesso.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {planos.map((plano) => {
          const isAtual = planoAtual === plano.id
          const isSel = selecionado === plano.id

          return (
            <div
              key={plano.id}
              onClick={() => setSelecionado(plano.id)}
              className={`relative rounded-xl border p-6 flex flex-col transition cursor-pointer ${
                isAtual
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : isSel
                  ? 'border-brand-400 bg-brand-500/10 shadow-lg shadow-brand-500/10 scale-[1.02]'
                  : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-800/40'
              }`}
            >
              {plano.destaque && !isAtual && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-600 text-white text-xs font-semibold">
                  Mais popular
                </span>
              )}
              {isAtual && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-semibold">
                  Plano atual
                </span>
              )}

              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-100">{plano.nome}</h2>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{plano.descricao}</p>
              </div>

              <div className="mb-6">
                {plano.preco_mensal != null ? (
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-slate-100">
                      R$ {plano.preco_mensal.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-sm text-slate-500 mb-1">/mês</span>
                  </div>
                ) : (
                  <span className="text-lg font-semibold text-slate-400">Sob consulta</span>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plano.features.map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400 text-xs shrink-0">✓</span>
                    {FEATURE_LABEL[key] ?? key}
                  </li>
                ))}
              </ul>

              <div className="text-xs text-slate-500 space-y-1 mb-5 border-t border-slate-800 pt-4">
                <div>Unidades: {plano.limite_unidades != null ? plano.limite_unidades : 'ilimitadas'}</div>
                <div>Staff: {plano.limite_staff != null ? plano.limite_staff : 'ilimitado'}</div>
                <div>Armazenamento: {plano.storage_gb != null ? `${plano.storage_gb} GB` : 'ilimitado'}</div>
              </div>

              {podeContratar ? (
                <button
                  onClick={(e) => { e.stopPropagation(); if (!isAtual) handleContratar(plano.id) }}
                  disabled={isAtual || loadingPlano !== null}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    isAtual
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 cursor-default'
                      : isSel
                      ? 'bg-brand-600 hover:bg-brand-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isAtual
                    ? 'Plano atual'
                    : loadingPlano === plano.id
                    ? 'Redirecionando...'
                    : 'Contratar'}
                </button>
              ) : (
                <a
                  href="mailto:contato@onwaytech.com.br?subject=Quero mudar de plano"
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold text-center transition ${
                    isAtual
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isAtual ? 'Plano atual' : 'Solicitar mudança de plano'}
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-xs text-slate-600 text-center">
        Todos os planos incluem suporte via chat e atualizações sem custo adicional.
        Para dúvidas sobre faturamento, fale com{' '}
        <a href="mailto:contato@onwaytech.com.br" className="text-slate-500 hover:text-slate-400 underline">
          contato@onwaytech.com.br
        </a>.
      </p>
    </div>
  )
}
