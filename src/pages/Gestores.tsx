import { useEffect, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import { listStaffCondominio } from '../lib/chat'
import type { Condominio } from '../types/condominio'
import PageHeader from '../components/ui/PageHeader'
import { Select } from '../components/ui/Input'
import ConvitesPanel from '../components/ConvitesPanel'
import VincularUserAoCondo from '../components/VincularUserAoCondo'
import { roleLabel } from '../lib/nav'
import type { Role } from '../types/database'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'

interface StaffMembro {
  id: string
  nome_exibicao: string | null
  role: string
  email?: string | null
  ativo?: boolean
}

const ROLE_COLOR: Record<string, string> = {
  administradora: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  sindico:        'bg-brand-500/15 text-brand-300 border-brand-500/30',
  subsindico:     'bg-sky-500/15 text-sky-300 border-sky-500/30',
  conselheiro:    'bg-teal-500/15 text-teal-300 border-teal-500/30',
  portaria:       'bg-amber-500/15 text-amber-300 border-amber-500/30',
  ronda:          'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

export default function Gestores() {
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string>('')
  const [scopeNome, setScopeNome] = useState<string>('')
  const [staff, setStaff] = useState<StaffMembro[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then((cs) => {
        setCondos(cs)
        if (cs.length && !scopeId) { setScopeId(cs[0].id); setScopeNome(cs[0].nome) }
      }).catch(() => {})
    } else if (perfil?.condominio_id) {
      setScopeId(perfil.condominio_id)
    }
  }, [isAdmin, perfil])

  useEffect(() => {
    if (!scopeId) return
    setLoading(true)
    listStaffCondominio(scopeId)
      .then((data) => setStaff(data as StaffMembro[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [scopeId])

  function handleCondoChange(id: string) {
    setScopeId(id)
    const c = condos.find((x) => x.id === id)
    if (c) setScopeNome(c.nome)
  }

  async function handleDesativar(membro: StaffMembro) {
    const ok = await confirm({
      message: `Remover acesso de ${membro.nome_exibicao ?? membro.id} (${roleLabel(membro.role as Role)})?`,
      confirmText: 'Remover acesso',
    })
    if (!ok) return
    const { error } = await supabase
      .from('perfis')
      .update({ ativo: false })
      .eq('id', membro.id)
      .eq('condominio_id', scopeId)
    if (error) { toast.error('Erro', error.message); return }
    toast.success('Acesso removido.')
    setStaff((prev) => prev.filter((m) => m.id !== membro.id))
  }

  const canManage = perfil && ['admin_onway', 'administradora', 'sindico'].includes(perfil.role)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto space-y-10">
      <PageHeader
        title="Gestores e equipe"
        subtitle="Crie convites, vincule usuários existentes e gerencie os acessos da equipe do condomínio."
      />

      {isAdmin && condos.length > 0 && (
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
          <Select value={scopeId} onChange={(e) => handleCondoChange(e.target.value)}>
            {condos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </div>
      )}

      {scopeId && (
        <>
          {/* Lista de usuários ativos */}
          <section>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Equipe ativa</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : staff.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum gestor cadastrado ainda.</p>
            ) : (
              <div className="rounded-lg border border-slate-800 divide-y divide-slate-800 overflow-hidden">
                {staff.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900/30 hover:bg-slate-900/60 transition">
                    <div className="w-8 h-8 rounded-full bg-brand-700/30 text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {(m.nome_exibicao ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{m.nome_exibicao ?? '—'}</div>
                      {m.email && <div className="text-xs text-slate-500 truncate">{m.email}</div>}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLOR[m.role] ?? 'bg-slate-700/30 text-slate-400 border-slate-700'}`}>
                      {roleLabel(m.role as Role)}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDesativar(m)}
                        className="text-xs text-slate-600 hover:text-red-400 transition px-1"
                        title="Remover acesso"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Vincular usuário existente (admin_onway only) */}
          {perfil?.role === 'admin_onway' && (
            <section>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Vincular usuário existente</h2>
              <VincularUserAoCondo
                condominio_id={scopeId}
                condominio_nome={scopeNome}
                onChange={() => {
                  listStaffCondominio(scopeId).then((d) => setStaff(d as StaffMembro[])).catch(() => {})
                }}
              />
            </section>
          )}

          {/* Convites por link/código */}
          {canManage && (
            <section>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Convites de acesso</h2>
              <ConvitesPanel condominio_id={scopeId} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
