import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listAssinaturas, updateAssinatura } from '../lib/billing'
import { supabase } from '../lib/supabase'
import type { Assinatura, PlanoId, AssinaturaStatus } from '../types/billing'
import type { FeatureKey } from '../types/featureFlag'
import { PLANO_CATALOG } from '../types/billing'
import { ROUTE_FEATURE } from '../types/featureFlag'
import PageHeader from '../components/ui/PageHeader'
import { useToast } from '../components/ui/Toast'

interface CondominioRow {
  id: string
  nome: string
}

interface Row extends Assinatura {
  condominio_nome?: string
}

const ALL_FEATURES = Array.from(new Set(Object.values(ROUTE_FEATURE))) as FeatureKey[]

const STATUS_LABEL: Record<AssinaturaStatus, string> = {
  trial:        'Trial',
  ativo:        'Ativo',
  inadimplente: 'Inadimplente',
  cancelado:    'Cancelado',
}

const STATUS_COLOR: Record<AssinaturaStatus, string> = {
  trial:        'text-amber-400 bg-amber-500/10 border-amber-500/30',
  ativo:        'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  inadimplente: 'text-red-400 bg-red-500/10 border-red-500/30',
  cancelado:    'text-slate-500 bg-slate-700/20 border-slate-700',
}

export default function AssinaturasAdmin() {
  const { perfil } = useAuth()
  if (perfil && perfil.role !== 'admin_onway') return <Navigate to="/" replace />

  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state for the editing row
  const [editPlano, setEditPlano] = useState<PlanoId>('profissional')
  const [editStatus, setEditStatus] = useState<AssinaturaStatus>('trial')
  const [editTrialEnd, setEditTrialEnd] = useState('')
  const [editExtras, setEditExtras] = useState<FeatureKey[]>([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [assinaturas, { data: condos }] = await Promise.all([
        listAssinaturas(),
        supabase.from('condominios').select('id, nome'),
      ])
      const condoMap = Object.fromEntries((condos ?? []).map((c: CondominioRow) => [c.id, c.nome]))
      setRows(assinaturas.map((a) => ({ ...a, condominio_nome: condoMap[a.condominio_id] ?? '—' })))
    } catch (e) {
      toast.error('Erro ao carregar', e instanceof Error ? e.message : '')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(row: Row) {
    setEditing(row.condominio_id)
    setEditPlano(row.plano_id ?? 'profissional')
    setEditStatus(row.status)
    setEditTrialEnd(row.trial_ends_at ? row.trial_ends_at.slice(0, 10) : '')
    setEditExtras(row.features_extras ?? [])
  }

  async function save(condoId: string) {
    setSaving(true)
    try {
      const plano = PLANO_CATALOG.find((p) => p.id === editPlano)
      await updateAssinatura(condoId, {
        plano_id: editPlano,
        status: editStatus,
        features_plano: (plano?.features ?? []) as FeatureKey[],
        features_extras: editExtras,
        trial_ends_at: editTrialEnd ? new Date(editTrialEnd).toISOString() : null,
      })
      toast.success('Assinatura atualizada.')
      setEditing(null)
      await load()
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : '')
    } finally {
      setSaving(false)
    }
  }

  function toggleExtra(key: FeatureKey) {
    setEditExtras((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const currentPlanoFeatures = PLANO_CATALOG.find((p) => p.id === editPlano)?.features ?? []

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Assinaturas"
        subtitle="Gerencie planos e funcionalidades de cada condomínio."
      />

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.condominio_id} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              {/* Header da linha */}
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{row.condominio_nome}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {PLANO_CATALOG.find((p) => p.id === row.plano_id)?.nome ?? row.plano_id ?? '—'}
                    {row.trial_ends_at && row.status === 'trial' && (
                      <> · trial até {new Date(row.trial_ends_at).toLocaleDateString('pt-BR')}</>
                    )}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </span>
                <button
                  onClick={() => editing === row.condominio_id ? setEditing(null) : startEdit(row)}
                  className="text-xs text-brand-400 hover:text-brand-300 transition shrink-0"
                >
                  {editing === row.condominio_id ? 'Fechar' : 'Editar'}
                </button>
              </div>

              {/* Painel de edição */}
              {editing === row.condominio_id && (
                <div className="border-t border-slate-800 px-4 py-4 bg-slate-900/60 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Plano */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Plano</label>
                      <select
                        value={editPlano}
                        onChange={(e) => setEditPlano(e.target.value as PlanoId)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                      >
                        {PLANO_CATALOG.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as AssinaturaStatus)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                      >
                        {(Object.keys(STATUS_LABEL) as AssinaturaStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>

                    {/* Trial end */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Vencimento trial</label>
                      <input
                        type="date"
                        value={editTrialEnd}
                        onChange={(e) => setEditTrialEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                      />
                    </div>
                  </div>

                  {/* Features extras */}
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">
                      Funcionalidades extras (além do plano)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_FEATURES.filter((f) => !currentPlanoFeatures.includes(f)).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => toggleExtra(f)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                            editExtras.includes(f)
                              ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                              : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {editExtras.includes(f) ? '✓ ' : ''}{f}
                        </button>
                      ))}
                    </div>
                    {ALL_FEATURES.filter((f) => !currentPlanoFeatures.includes(f)).length === 0 && (
                      <p className="text-xs text-slate-600">Plano completo — sem features adicionais disponíveis.</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => save(row.condominio_id)}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition disabled:opacity-60"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {rows.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma assinatura encontrada.</p>
          )}
        </div>
      )}
    </div>
  )
}
