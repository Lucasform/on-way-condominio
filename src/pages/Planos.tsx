import { useState } from 'react'
import { PLANO_CATALOG, FEATURE_PRICE, FEATURE_PRICE_MIN_QTD } from '../types/billing'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import type { FeatureKey } from '../types/featureFlag'
import PageHeader from '../components/ui/PageHeader'
import { supabase } from '../lib/supabase'

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
}

const ALL_FEATURES = Object.keys(FEATURE_PRICE) as FeatureKey[]

export default function Planos() {
  const { assinatura } = useFeatureFlags()
  const [tab, setTab] = useState<'planos' | 'custom'>('planos')
  const [selecionadas, setSelecionadas] = useState<Set<FeatureKey>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)

  async function handleContratar(planoId: string) {
    setLoadingPlano(planoId)
    setCheckoutError(null)
    try {
      const origin = window.location.origin
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          plano_id: planoId,
          success_url: `${origin}/checkout/sucesso`,
          cancel_url: `${origin}/planos`,
        },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('URL de checkout não retornada.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar checkout.'
      setCheckoutError(msg)
    } finally {
      setLoadingPlano(null)
    }
  }

  function toggleFeature(key: FeatureKey) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const totalCustom = [...selecionadas].reduce((acc, key) => acc + (FEATURE_PRICE[key] ?? 0), 0)
  const podeContratar = selecionadas.size >= FEATURE_PRICE_MIN_QTD

  const planoAtual = assinatura?.plano_id ?? null
  const emTrial = !assinatura || assinatura.status === 'trial'

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Planos"
        subtitle="Escolha o plano ideal ou monte o seu."
      />

      {checkoutError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{checkoutError}</span>
        </div>
      )}

      {emTrial && assinatura?.trial_ends_at && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Você está em período de teste gratuito até{' '}
          <strong>{new Date(assinatura.trial_ends_at).toLocaleDateString('pt-BR')}</strong>.
          Escolha um plano antes do vencimento para manter o acesso.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {(['planos', 'custom'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              tab === t
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {t === 'planos' ? 'Planos prontos' : 'Personalizado (à la carte)'}
          </button>
        ))}
      </div>

      {/* Planos prontos */}
      {tab === 'planos' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANO_CATALOG.filter((p) => p.id !== 'custom').map((plano) => (
            <div
              key={plano.id}
              onClick={() => setSelecionado(plano.id)}
              className={`relative rounded-xl border p-6 flex flex-col transition cursor-pointer ${
                selecionado === plano.id
                  ? 'border-brand-400 bg-brand-500/10 shadow-lg shadow-brand-500/10 scale-[1.02]'
                  : 'border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-800/40'
              }`}
            >
              {plano.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-600 text-white text-xs font-semibold">
                  Mais popular
                </span>
              )}
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-100">{plano.nome}</h2>
                <p className="text-sm text-slate-400 mt-1">{plano.descricao}</p>
              </div>

              <div className="mb-6">
                {plano.preco_mensal != null ? (
                  <div>
                    <span className="text-3xl font-bold text-slate-100">
                      R$ {plano.preco_mensal.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-sm text-slate-500">/mês</span>
                  </div>
                ) : (
                  <span className="text-lg font-semibold text-slate-400">Sob consulta</span>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plano.features.map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400 text-xs">✓</span>
                    {FEATURE_LABEL[key]}
                  </li>
                ))}
              </ul>

              <div className="text-xs text-slate-500 space-y-1 mb-6">
                <div>Unidades: {plano.limite_unidades ?? 'ilimitadas'}</div>
                <div>Staff: {plano.limite_staff ?? 'ilimitado'}</div>
                <div>Storage: {plano.storage_gb != null ? `${plano.storage_gb} GB` : 'ilimitado'}</div>
              </div>

              <button
                onClick={() => planoAtual !== plano.id && handleContratar(plano.id)}
                disabled={planoAtual === plano.id || loadingPlano !== null}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${
                  planoAtual === plano.id
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 cursor-default'
                    : selecionado === plano.id
                    ? 'bg-brand-600 hover:bg-brand-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {planoAtual === plano.id
                  ? 'Plano atual'
                  : loadingPlano === plano.id
                  ? 'Redirecionando...'
                  : 'Contratar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* À la carte */}
      {tab === 'custom' && (
        <div>
          <p className="text-sm text-slate-400 mb-6">
            Selecione no mínimo {FEATURE_PRICE_MIN_QTD} funcionalidades. Cada item tem um valor fixo mensal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
            {ALL_FEATURES.map((key) => {
              const sel = selecionadas.has(key)
              return (
                <button
                  key={key}
                  onClick={() => toggleFeature(key)}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-4 text-left transition ${
                    sel
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-slate-700 bg-slate-900/30 hover:border-slate-600'
                  }`}
                >
                  <span className="text-sm text-slate-200">{FEATURE_LABEL[key]}</span>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-emerald-400">
                      R$ {FEATURE_PRICE[key]}/mês
                    </div>
                    {sel && <div className="text-[10px] text-brand-400">selecionado</div>}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="sticky bottom-6 rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-slate-400">
                {selecionadas.size} funcionalidade{selecionadas.size !== 1 ? 's' : ''} selecionada{selecionadas.size !== 1 ? 's' : ''}
                {selecionadas.size < FEATURE_PRICE_MIN_QTD && (
                  <span className="text-amber-400 ml-2">
                    (mínimo {FEATURE_PRICE_MIN_QTD})
                  </span>
                )}
              </div>
              {selecionadas.size >= FEATURE_PRICE_MIN_QTD && (
                <div className="text-xl font-bold text-slate-100">
                  R$ {totalCustom.toLocaleString('pt-BR')}/mês
                </div>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              disabled={!podeContratar}
              className="px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Contratar
            </button>
          </div>
        </div>
      )}

      {/* Modal "Em breve" */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="text-2xl mb-3">🚀</div>
            <h2 className="text-lg font-bold text-slate-100 mb-2">Pagamento online em breve</h2>
            <p className="text-sm text-slate-400 mb-4">
              A integração com cartão de crédito está sendo finalizada. Para ativar seu plano agora,
              entre em contato e fazemos a ativação manual imediatamente.
            </p>
            <a
              href="mailto:contato@onway.com.br?subject=Quero contratar o OnWay Condomínio"
              className="block w-full text-center py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition mb-3"
            >
              Entrar em contato
            </a>
            <button
              onClick={() => setShowModal(false)}
              className="block w-full text-center py-2 rounded-lg text-slate-400 text-sm hover:text-slate-200 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
