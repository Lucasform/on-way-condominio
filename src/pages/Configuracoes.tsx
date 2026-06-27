import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import PageHeader from '../components/ui/PageHeader'
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import { listCondoFeatureOverrides, upsertCondoFeatureOverride } from '../lib/condoFeatureOverrides'
import type { FeatureKey } from '../types/featureFlag'

// I3: Página de configurações de funcionalidades para síndico/administradora.
// Permite ativar/desativar módulos específicos do próprio condomínio.

const MODULOS: { key: FeatureKey; label: string; descricao: string; emoji: string }[] = [
  { key: 'portaria',     emoji: '🏠', label: 'Portaria',              descricao: 'Encomendas, plantão e controle de acesso.' },
  { key: 'acessos',     emoji: '🔑', label: 'Acessos autorizados',   descricao: 'Liberação de visitantes e prestadores.' },
  { key: 'moradores',   emoji: '👥', label: 'Moradores e unidades',  descricao: 'Perfis de moradores e cadastro de unidades.' },
  { key: 'pets',        emoji: '🐾', label: 'Pets',                  descricao: 'Cadastro de animais de estimação por unidade.' },
  { key: 'veiculos',    emoji: '🚗', label: 'Veículos',              descricao: 'Controle de veículos dos condôminos.' },
  { key: 'ocorrencias', emoji: '⚠️', label: 'Ocorrências',          descricao: 'Registro e acompanhamento de ocorrências.' },
  { key: 'multas',      emoji: '💰', label: 'Multas',                descricao: 'Emissão e gestão de multas.' },
  { key: 'chamados',    emoji: '🛠',  label: 'Chamados',             descricao: 'Solicitações de manutenção.' },
  { key: 'mural',       emoji: '📌', label: 'Mural informativo',     descricao: 'Publicações e avisos no mural.' },
  { key: 'comunicados', emoji: '📢', label: 'Comunicados',           descricao: 'Comunicados oficiais com IA.' },
  { key: 'chat',        emoji: '💬', label: 'Chat',                  descricao: 'Mensagens entre morador e gestão.' },
  { key: 'classificados',emoji: '🛒', label: 'Classificados',        descricao: 'Anúncios e serviços entre moradores.' },
  { key: 'calendario',  emoji: '📅', label: 'Calendário',            descricao: 'Eventos e agendamentos do condomínio.' },
  { key: 'assembleias', emoji: '🗳️', label: 'Assembleias',          descricao: 'Convocações e votações oficiais.' },
  { key: 'regimento',   emoji: '📋', label: 'Regimento',             descricao: 'Regimento interno e base da IA.' },
  { key: 'relatorios',  emoji: '📊', label: 'Relatórios',            descricao: 'Exportações e relatórios gerenciais.' },
  { key: 'whatsapp',    emoji: '💚', label: 'WhatsApp',              descricao: 'Integração com WhatsApp via Evolution.' },
]

export default function Configuracoes() {
  const { perfil, user } = useAuth()
  const toast = useToast()
  const { flags } = useFeatureFlags()

  const isGestorCondo =
    perfil && ['administradora', 'sindico', 'subsindico', 'admin_onway'].includes(perfil.role)

  if (!isGestorCondo) return <Navigate to="/" replace />

  const condoId = perfil?.condominio_id
  const [overrides, setOverrides] = useState<Record<FeatureKey, boolean>>({} as Record<FeatureKey, boolean>)
  const [busy, setBusy] = useState<FeatureKey | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!condoId) { setLoading(false); return }
    listCondoFeatureOverrides(condoId)
      .then((list) => {
        const map: Record<string, boolean> = {}
        list.forEach((o) => { map[o.key] = o.ativo })
        setOverrides(map as Record<FeatureKey, boolean>)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [condoId])

  function globalAtivo(key: FeatureKey) {
    return flags.find((f) => f.key === key)?.ativo ?? false
  }

  function condoAtivo(key: FeatureKey) {
    if (key in overrides) return overrides[key]
    return globalAtivo(key)
  }

  async function handleToggle(key: FeatureKey, ativo: boolean) {
    if (!condoId || !user) return
    setBusy(key)
    try {
      await upsertCondoFeatureOverride(condoId, key, ativo, user.id)
      setOverrides((prev) => ({ ...prev, [key]: ativo }))
      toast.success(ativo ? 'Módulo ativado.' : 'Módulo desativado.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Configurações do condomínio"
        subtitle="Ative ou desative módulos para este condomínio."
      />

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : !condoId ? (
        <div className="text-sm text-slate-500">Selecione um condomínio para configurar.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {MODULOS.map(({ key, label, descricao, emoji }) => {
            const ativo = condoAtivo(key)
            const globalOff = !globalAtivo(key)
            const isBusy = busy === key
            return (
              <div
                key={key}
                className={`flex items-start gap-3 rounded-lg border p-4 transition ${
                  ativo
                    ? 'border-slate-700 bg-slate-900/40'
                    : 'border-slate-800 bg-slate-900/20 opacity-50'
                }`}
              >
                <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{descricao}</div>
                  {globalOff && (
                    <div className="text-[10px] text-amber-400 mt-1">Desabilitado globalmente pela OnWay.</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isBusy || globalOff}
                  onClick={() => handleToggle(key, !ativo)}
                  className={`shrink-0 relative w-10 h-6 rounded-full transition-colors ${
                    ativo ? 'bg-violet-600' : 'bg-slate-700'
                  } disabled:opacity-40`}
                  title={ativo ? 'Desativar módulo' : 'Ativar módulo'}
                  aria-label={`${ativo ? 'Desativar' : 'Ativar'} ${label}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${ativo ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
