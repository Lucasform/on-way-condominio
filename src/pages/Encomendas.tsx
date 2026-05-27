import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listEncomendas } from '../lib/encomendas'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Encomenda, StatusEncomenda, TipoEncomenda } from '../types/encomenda'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

const STATUS_OPTS: { value: '' | StatusEncomenda; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'aguardando', label: 'Aguardando retirada' },
  { value: 'entregue', label: 'Entregues' },
  { value: 'devolvida', label: 'Devolvidas' },
]

const STATUS_CLASS: Record<StatusEncomenda, string> = {
  aguardando: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  entregue: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  devolvida: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

const STATUS_LABEL: Record<StatusEncomenda, string> = {
  aguardando: 'Aguardando',
  entregue: 'Entregue',
  devolvida: 'Devolvida',
}

const TIPO_ICON: Record<TipoEncomenda, string> = {
  encomenda: '📦',
  comida: '🍔',
  documento: '📄',
  outro: '📬',
}

const TIPO_LABEL: Record<TipoEncomenda, string> = {
  encomenda: 'Encomenda',
  comida: 'Comida',
  documento: 'Documento',
  outro: 'Outro',
}

export default function Encomendas() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const isMorador = perfil?.role === 'morador'

  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | StatusEncomenda>('aguardando')
  const [rows, setRows] = useState<Encomenda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => {
          setCondos(cs)
          if (cs.length && !scopeId) setScopeId(cs[0].id)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  useEffect(() => {
    listUnidades().then(setUnidades).catch(() => {})
  }, [])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listEncomendas({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        status: statusFilter || undefined,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, statusFilter])

  const unidadeLabel = (uid: string) => {
    const u = unidades.find((x) => x.id === uid)
    return u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : '—'
  }

  const canRegister = perfil && ['admin_onway', 'administradora', 'sindico', 'portaria'].includes(perfil.role)
  const aguardando = rows.filter((r) => r.status === 'aguardando').length

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        title={isMorador ? 'Minhas encomendas' : `Encomendas${aguardando > 0 ? ` (${aguardando} aguardando)` : ''}`}
        subtitle={
          isMorador
            ? 'Encomendas que chegaram pra você ou pra sua unidade.'
            : 'Pacotes, comida e documentos recebidos na portaria.'
        }
        actions={
          canRegister && (
            <div className="flex items-center flex-wrap gap-2">
              <Link to="/encomendas/novo?tipo=encomenda">
                <Button>📦 Pacote</Button>
              </Link>
              <Link to="/encomendas/novo?tipo=comida">
                <Button variant="secondary">🍔 Comida</Button>
              </Link>
              <Link to="/encomendas/novo?tipo=documento">
                <Button variant="secondary">📄 Documento</Button>
              </Link>
              <Link to="/encomendas/novo?tipo=outro">
                <Button variant="secondary">📬 Outro</Button>
              </Link>
            </div>
          )
        }
      />

      <div className="mb-5 flex flex-wrap gap-4 items-end">
        {isAdmin && condos.length > 0 && (
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
            <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | StatusEncomenda)}
          >
            {STATUS_OPTS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-sm">
          Nenhuma encomenda encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => (
            <article
              key={e.id}
              onClick={() => navigate(`/encomendas/${e.id}`)}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 flex gap-4 cursor-pointer hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="text-3xl shrink-0 leading-none">{TIPO_ICON[e.tipo]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 justify-between flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">{TIPO_LABEL[e.tipo]}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-sm font-medium text-slate-200">{unidadeLabel(e.unidade_id)}</span>
                    {e.transportadora && (
                      <>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-400">{e.transportadora}</span>
                      </>
                    )}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[e.status]}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </div>
                {e.descricao && (
                  <p className="mt-1 text-sm text-slate-300 line-clamp-2">{e.descricao}</p>
                )}
                <div className="mt-1.5 text-xs text-slate-500 flex gap-3 flex-wrap">
                  <span>Recebida em {new Date(e.created_at).toLocaleString('pt-BR')}</span>
                  {e.local_armazenamento && (
                    <span>📍 {e.local_armazenamento}</span>
                  )}
                  {e.entregue_em && (
                    <span>Entregue em {new Date(e.entregue_em).toLocaleString('pt-BR')}</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

