import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import {
  listConvitesPlataforma,
  createConvitePlataforma,
  revogarConvitePlataforma,
  deleteConvitePlataforma,
  listParceiros,
  listCondominiosDoParceiro,
  vincularParceiroCondominio,
  toggleVinculoAtivo,
  type ConvitePlataforma,
  type PerfilCondominio,
} from '../lib/convitesPlataforma'
import { supabase } from '../lib/supabase'

interface Parceiro {
  id: string
  nome: string | null
  email: string | null
  ativo: boolean
  created_at: string
}

interface CondominioItem {
  id: string
  nome: string
}

export default function Parceiros() {
  const { perfil } = useAuth()
  if (perfil && perfil.role !== 'admin_onway') return <Navigate to="/" replace />

  const toast = useToast()
  const confirm = useConfirm()

  // — Tabs
  const [tab, setTab] = useState<'convites' | 'parceiros'>('convites')

  // — Convites
  const [convites, setConvites] = useState<ConvitePlataforma[]>([])
  const [loadingConvites, setLoadingConvites] = useState(true)
  const [nome, setNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // — Parceiros
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [loadingParceiros, setLoadingParceiros] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [condosDoExpandido, setCondosDoExpandido] = useState<PerfilCondominio[]>([])
  const [loadingCondos, setLoadingCondos] = useState(false)

  // — Vínculo de condomínio
  const [todosCondominios, setTodosCondominios] = useState<CondominioItem[]>([])
  const [condoSelecionado, setCondoSelecionado] = useState('')

  useEffect(() => {
    loadConvites()
    loadParceiros()
    loadTodosCondominios()
  }, [])

  async function loadConvites() {
    setLoadingConvites(true)
    try {
      setConvites(await listConvitesPlataforma())
    } catch (e: unknown) {
      toast.error('Erro ao carregar convites', (e as Error).message)
    } finally {
      setLoadingConvites(false)
    }
  }

  async function loadParceiros() {
    setLoadingParceiros(true)
    try {
      setParceiros(await listParceiros())
    } catch (e: unknown) {
      toast.error('Erro ao carregar parceiros', (e as Error).message)
    } finally {
      setLoadingParceiros(false)
    }
  }

  async function loadTodosCondominios() {
    const { data } = await supabase.from('condominios').select('id, nome').order('nome')
    setTodosCondominios((data ?? []) as CondominioItem[])
  }

  async function handleCriar() {
    setCriando(true)
    try {
      const c = await createConvitePlataforma({ nome_destinatario: nome.trim() || undefined })
      setConvites([c, ...convites])
      setNome('')
      toast.success('Convite gerado', `Código: ${c.codigo}`)
    } catch (e: unknown) {
      toast.error('Erro', (e as Error).message)
    } finally {
      setCriando(false)
    }
  }

  async function handleRevogar(id: string) {
    const ok = await confirm({ title: 'Revogar convite', message: 'O código não poderá mais ser utilizado.', confirmText: 'Revogar' })
    if (!ok) return
    try {
      await revogarConvitePlataforma(id)
      setConvites(convites.map(c => c.id === id ? { ...c, revogado: true } : c))
      toast.success('Convite revogado')
    } catch (e: unknown) {
      toast.error('Erro', (e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: 'Excluir convite', message: 'Isso é irreversível.', confirmText: 'Excluir' })
    if (!ok) return
    try {
      await deleteConvitePlataforma(id)
      setConvites(convites.filter(c => c.id !== id))
      toast.success('Convite removido')
    } catch (e: unknown) {
      toast.error('Erro', (e as Error).message)
    }
  }

  function copiarCodigo(codigo: string) {
    const link = `${window.location.origin}/parceiro/entrar?code=${codigo}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(codigo)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  async function handleExpandir(id: string) {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    setLoadingCondos(true)
    setCondoSelecionado('')
    try {
      setCondosDoExpandido(await listCondominiosDoParceiro(id))
    } finally {
      setLoadingCondos(false)
    }
  }

  async function handleVincular(perfilId: string) {
    if (!condoSelecionado) return
    try {
      await vincularParceiroCondominio(perfilId, condoSelecionado)
      setCondosDoExpandido(await listCondominiosDoParceiro(perfilId))
      setCondoSelecionado('')
      toast.success('Condomínio vinculado')
    } catch (e: unknown) {
      toast.error('Erro', (e as Error).message)
    }
  }

  async function handleToggleVinculo(vinculoId: string, ativo: boolean, perfilId: string) {
    try {
      await toggleVinculoAtivo(vinculoId, !ativo)
      setCondosDoExpandido(await listCondominiosDoParceiro(perfilId))
    } catch (e: unknown) {
      toast.error('Erro', (e as Error).message)
    }
  }

  function conviteStatus(c: ConvitePlataforma): { label: string; css: string } {
    if (c.revogado) return { label: 'Revogado', css: 'text-red-400 bg-red-500/10 border-red-500/30' }
    if (new Date(c.expira_em) < new Date()) return { label: 'Expirado', css: 'text-slate-400 bg-slate-700/20 border-slate-700' }
    if (c.usos >= c.usos_max) return { label: 'Usado', css: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
    return { label: 'Ativo', css: 'text-teal-400 bg-teal-500/10 border-teal-500/30' }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <PageHeader title="Parceiros" subtitle="Gestores externos de múltiplos condomínios" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700">
        {(['convites', 'parceiros'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'convites' ? '🔑 Convites' : '🤝 Parceiros'}
          </button>
        ))}
      </div>

      {/* ── Tab: Convites ───────────────────────────────────────── */}
      {tab === 'convites' && (
        <div>
          {/* Gerador */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
            <p className="text-sm text-slate-400 mb-3">
              Gere um código único. Envie o link para o parceiro criar a conta. O código expira em 30 dias e só pode ser usado 1 vez.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nome do destinatário (opcional)"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-400"
              />
              <button
                onClick={handleCriar}
                disabled={criando}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {criando ? 'Gerando...' : '+ Gerar convite'}
              </button>
            </div>
          </div>

          {/* Lista */}
          {loadingConvites ? (
            <p className="text-slate-400 text-sm">Carregando...</p>
          ) : convites.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum convite gerado ainda.</p>
          ) : (
            <div className="space-y-2">
              {convites.map(c => {
                const st = conviteStatus(c)
                return (
                  <div key={c.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-brand-400 font-bold tracking-widest">{c.codigo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${st.css}`}>{st.label}</span>
                      </div>
                      {c.nome_destinatario && (
                        <p className="text-xs text-slate-400 mt-0.5">Para: {c.nome_destinatario}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        Expira {new Date(c.expira_em).toLocaleDateString('pt-BR')} · {c.usos}/{c.usos_max} usos
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => copiarCodigo(c.codigo)}
                        className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors"
                      >
                        {copied === c.codigo ? '✓ Copiado' : '🔗 Copiar link'}
                      </button>
                      {!c.revogado && c.usos < c.usos_max && (
                        <button
                          onClick={() => handleRevogar(c.id)}
                          className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                        >
                          Revogar
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs px-2 py-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        title="Excluir"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Parceiros ──────────────────────────────────────── */}
      {tab === 'parceiros' && (
        <div>
          {loadingParceiros ? (
            <p className="text-slate-400 text-sm">Carregando...</p>
          ) : parceiros.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum parceiro cadastrado ainda. Gere um convite para começar.</p>
          ) : (
            <div className="space-y-2">
              {parceiros.map(p => (
                <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <button
                    onClick={() => handleExpandir(p.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-750 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{p.nome ?? '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Desde {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        {!p.ativo && <span className="ml-2 text-red-400">· Inativo</span>}
                      </p>
                    </div>
                    <span className="text-slate-400 text-sm ml-2">{expandido === p.id ? '▲' : '▼'}</span>
                  </button>

                  {expandido === p.id && (
                    <div className="border-t border-slate-700 p-4">
                      <p className="text-xs text-slate-400 font-medium mb-3">Condomínios vinculados</p>

                      {loadingCondos ? (
                        <p className="text-xs text-slate-500">Carregando...</p>
                      ) : (
                        <>
                          {condosDoExpandido.length === 0 ? (
                            <p className="text-xs text-slate-500 mb-3">Nenhum condomínio vinculado.</p>
                          ) : (
                            <div className="space-y-1 mb-3">
                              {condosDoExpandido.map(v => (
                                <div key={v.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                                  <span className="text-sm text-slate-200">{v.condominio_nome}</span>
                                  <button
                                    onClick={() => handleToggleVinculo(v.id, v.ativo, p.id)}
                                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                                      v.ativo
                                        ? 'text-emerald-400 border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                                        : 'text-slate-500 border-slate-600 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
                                    }`}
                                  >
                                    {v.ativo ? 'Ativo' : 'Inativo'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Vincular novo */}
                          <div className="flex gap-2">
                            <select
                              value={condoSelecionado}
                              onChange={e => setCondoSelecionado(e.target.value)}
                              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-400"
                            >
                              <option value="">Selecionar condomínio...</option>
                              {todosCondominios
                                .filter(c => !condosDoExpandido.some(v => v.condominio_id === c.id))
                                .map(c => (
                                  <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleVincular(p.id)}
                              disabled={!condoSelecionado}
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm disabled:opacity-40 transition-colors"
                            >
                              Vincular
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
