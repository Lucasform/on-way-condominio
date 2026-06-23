import { useFeatureFlags } from '../contexts/FeatureFlagsContext'
import type { FeatureKey } from '../types/featureFlag'
import { useToast } from '../components/ui/Toast'
import PageHeader from '../components/ui/PageHeader'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'

const GRUPOS: { label: string; keys: FeatureKey[] }[] = [
  {
    label: 'Operação',
    keys: ['portaria', 'acessos', 'moradores', 'ocorrencias', 'multas', 'chamados'],
  },
  {
    label: 'Comunicação',
    keys: ['mural', 'comunicados', 'chat', 'classificados', 'calendario', 'whatsapp'],
  },
  {
    label: 'Administração',
    keys: ['assembleias', 'regimento', 'servicos', 'relatorios', 'reservas'],
  },
]

export default function FeatureFlags() {
  const { perfil } = useAuth()
  if (perfil && perfil.role !== 'admin_onway') return <Navigate to="/" replace />

  const { flags, toggle, loading } = useFeatureFlags()
  const toast = useToast()
  const [busy, setBusy] = useState<FeatureKey | null>(null)

  const flagMap = Object.fromEntries(flags.map((f) => [f.key, f]))

  async function handleToggle(key: FeatureKey, ativo: boolean) {
    setBusy(key)
    try {
      await toggle(key, ativo)
      toast.success(ativo ? 'Funcionalidade ativada.' : 'Funcionalidade desativada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader title="Funcionalidades" subtitle="Ative ou desative módulos do produto." />
        <div className="text-sm text-slate-500">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Funcionalidades"
        subtitle="Ative ou desative módulos do produto em tempo real."
      />

      <div className="space-y-8">
        {GRUPOS.map((grupo) => (
          <div key={grupo.label}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              {grupo.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {grupo.keys.map((key) => {
                const flag = flagMap[key]
                if (!flag) return null
                const isBusy = busy === key
                return (
                  <div
                    key={key}
                    className={`flex items-start gap-4 rounded-lg border p-4 transition ${
                      flag.ativo
                        ? 'border-slate-700 bg-slate-900/40'
                        : 'border-slate-800 bg-slate-900/20 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${flag.ativo ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                        <span className="text-sm font-semibold text-slate-100 truncate">{flag.nome}</span>
                      </div>
                      {flag.descricao && (
                        <p className="text-xs text-slate-500 leading-snug mt-0.5">{flag.descricao}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggle(key, !flag.ativo)}
                      disabled={isBusy}
                      title={flag.ativo ? 'Desativar' : 'Ativar'}
                      className={`shrink-0 relative w-11 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                        flag.ativo ? 'bg-brand-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          flag.ativo ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
        As alterações têm efeito imediato para todos os usuários. Funcionalidades desativadas somem do menu e as rotas ficam inacessíveis.
      </div>
    </div>
  )
}
