/**
 * Plantão — tela unificada para o papel de portaria.
 * Agrega encomendas pendentes, acessos de hoje e ações rápidas em uma única tela.
 */
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listEncomendas, darBaixaEncomenda } from '../lib/encomendas'
import { listAcessos } from '../lib/acessos'
import { listUnidades } from '../lib/unidades'
import { useToast } from '../components/ui/Toast'
import type { Encomenda } from '../types/encomenda'
import type { AcessoAutorizado } from '../types/acesso'
import type { Unidade } from '../types/unidade'
import {
  Package, KeyRound, AlertTriangle, Wrench, RefreshCw,
  ChevronRight, ArrowRight, CheckCircle2,
} from 'lucide-react'

const TIPO_ICON: Record<string, string> = {
  encomenda: '📦',
  comida: '🍔',
  documento: '📄',
  outro: '📬',
}

const TIPO_ACESSO: Record<string, string> = {
  visitante: '👤',
  prestador: '🛠',
  entregador: '🛵',
  familiar: '👨‍👩‍👧',
  fixo: '🔁',
}

function isHoje(iso: string): boolean {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function Plantao() {
  const { perfil } = useAuth()
  const toast = useToast()
  const condoId = perfil?.condominio_id ?? null

  const [encomendas, setEncomendas] = useState<Encomenda[]>([])
  const [acessos, setAcessos] = useState<AcessoAutorizado[]>([])
  const [unidadesMap, setUnidadesMap] = useState<Record<string, Unidade>>({})
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [entregandoId, setEntregandoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!condoId) { setLoading(false); return }
    setLoading(true)
    try {
      const [enc, acess, unds] = await Promise.all([
        listEncomendas({ condominio_id: condoId, status: 'aguardando' }),
        listAcessos({ condominio_id: condoId }),
        listUnidades({ condominio_id: condoId, ativo: true }),
      ])
      setEncomendas(enc.slice(0, 30))
      setAcessos(acess.filter((a) => isHoje(a.created_at) || (a.status === 'ativo')).slice(0, 30))
      const map: Record<string, Unidade> = {}
      for (const u of unds) map[u.id] = u
      setUnidadesMap(map)
    } catch (e) {
      toast.error('Erro ao carregar dados do plantão')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [condoId, toast])

  useEffect(() => { void carregar() }, [carregar])

  async function handleEntregarEncomenda(id: string, codigoRetirada: string | null) {
    if (codigoRetirada && confirmId !== id) {
      setConfirmId(id)
      return
    }
    setEntregandoId(id)
    try {
      await darBaixaEncomenda(id, '(portaria)', perfil?.nome_exibicao ?? 'Portaria')
      toast.success('Entrega registrada')
      setEncomendas((prev) => prev.filter((e) => e.id !== id))
    } catch {
      toast.error('Erro ao registrar entrega')
    } finally {
      setEntregandoId(null)
      setConfirmId(null)
    }
  }

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  if (!condoId) {
    return (
      <div className="p-8 text-center text-slate-400">
        Selecione um condomínio para acessar o plantão.
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Plantão</h1>
          <p className="text-sm text-slate-400 capitalize">{hoje}</p>
        </div>
        <button
          onClick={() => void carregar()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Aguardando retirada"
          value={loading ? '…' : String(encomendas.length)}
          color="amber"
        />
        <StatCard
          icon={<KeyRound className="w-5 h-5" />}
          label="Acessos hoje / ativos"
          value={loading ? '…' : String(acessos.length)}
          color="sky"
        />
      </div>

      {/* Ações rápidas */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Ações rápidas</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction icon={<Package className="w-5 h-5" />} label="Nova encomenda" to="/encomendas/nova" color="amber" />
          <QuickAction icon={<KeyRound className="w-5 h-5" />} label="Novo acesso" to="/acessos/novo" color="sky" />
          <QuickAction icon={<AlertTriangle className="w-5 h-5" />} label="Ocorrência" to="/ocorrencias/novo" color="red" />
          <QuickAction icon={<Wrench className="w-5 h-5" />} label="Chamado" to="/chamados/novo" color="violet" />
        </div>
      </section>

      {/* Encomendas aguardando */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Encomendas aguardando ({encomendas.length})
          </h2>
          <Link to="/encomendas" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : encomendas.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-800/20 rounded-xl">
            Nenhuma encomenda aguardando
          </div>
        ) : (
          <ul className="space-y-2">
            {encomendas.map((enc) => {
              const unidade = enc.unidade_id ? unidadesMap[enc.unidade_id] : null
              const unLabel = unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'
              const isConfirming = confirmId === enc.id
              return (
                <li key={enc.id} className="flex items-center gap-3 bg-slate-800/40 rounded-xl px-3 py-2.5 border border-slate-700/50">
                  <span className="text-xl shrink-0">{TIPO_ICON[enc.tipo] ?? '📬'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">
                        {enc.descricao || 'Encomenda'}
                      </span>
                      {enc.codigo_retirada && (
                        <span className="text-[10px] font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded shrink-0">
                          {enc.codigo_retirada}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      Unidade {unLabel} · {new Date(enc.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isConfirming ? (
                      <>
                        <span className="text-xs text-amber-400">Confirmar?</span>
                        <button
                          onClick={() => void handleEntregarEncomenda(enc.id, enc.codigo_retirada)}
                          disabled={entregandoId === enc.id}
                          className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition text-xs"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => void handleEntregarEncomenda(enc.id, enc.codigo_retirada)}
                          disabled={entregandoId === enc.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition disabled:opacity-40"
                        >
                          {entregandoId === enc.id ? '…' : 'Entregar'}
                        </button>
                        <Link
                          to={`/encomendas/${enc.id}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Acessos do dia */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Acessos hoje / ativos ({acessos.length})
          </h2>
          <Link to="/acessos" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : acessos.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-800/20 rounded-xl">
            Nenhum acesso registrado hoje
          </div>
        ) : (
          <ul className="space-y-2">
            {acessos.map((a) => {
              const unidade = a.unidade_id ? unidadesMap[a.unidade_id] : null
              const unLabel = unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'
              const statusCls = a.status === 'ativo'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : a.status === 'usado'
                  ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                  : 'bg-slate-700/40 text-slate-400 border-slate-700'
              const statusLabel: Record<string, string> = {
                ativo: 'Ativo', usado: 'Entrou', expirado: 'Expirado', revogado: 'Revogado', negado: 'Negado',
              }
              return (
                <li key={a.id} className="flex items-center gap-3 bg-slate-800/40 rounded-xl px-3 py-2.5 border border-slate-700/50">
                  <span className="text-xl shrink-0">{TIPO_ACESSO[a.tipo] ?? '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">{a.nome || '—'}</div>
                    <div className="text-xs text-slate-400">Un. {unLabel} · {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusCls}`}>
                      {statusLabel[a.status] ?? a.status}
                    </span>
                    <Link
                      to={`/acessos/${a.id}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'amber' | 'sky' | 'emerald' | 'violet'
}) {
  const colorMap = {
    amber: 'bg-amber-500/10 text-amber-400',
    sky: 'bg-sky-500/10 text-sky-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-400',
  }
  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

function QuickAction({
  icon, label, to, color,
}: {
  icon: React.ReactNode
  label: string
  to: string
  color: 'amber' | 'sky' | 'red' | 'violet'
}) {
  const navigate = useNavigate()
  const colorMap = {
    amber: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
    sky: 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20',
    red: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
    violet: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20',
  }
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-700/50 ${colorMap[color]} transition cursor-pointer`}
    >
      {icon}
      <span className="text-xs font-medium text-slate-300 text-center leading-tight">{label}</span>
    </button>
  )
}
