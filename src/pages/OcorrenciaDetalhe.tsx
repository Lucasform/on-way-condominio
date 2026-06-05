import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  deleteOcorrencia,
  getOcorrencia,
  getOcorrenciaFotoSignedUrl,
  updateOcorrencia,
  updateOcorrenciaStatus,
} from '../lib/ocorrencias'
import { getUnidade, listUnidades } from '../lib/unidades'
import { getPessoa } from '../lib/pessoas'
import { getCondominio } from '../lib/condominios'
import { getMultaByOcorrencia } from '../lib/multas'
import type { Ocorrencia, StatusOcorrencia } from '../types/ocorrencia'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import type { Multa } from '../types/multa'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import AIAnalysisPanel from '../components/AIAnalysisPanel'

const STATUS_LABEL: Record<StatusOcorrencia, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  arquivada: 'Arquivada',
  virou_multa: 'Virou multa',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<StatusOcorrencia, string> = {
  aberta: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_analise: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  arquivada: 'bg-slate-700/40 text-slate-400 border-slate-700',
  virou_multa: 'bg-red-500/10 text-red-300 border-red-500/30',
  cancelada: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

// Quem pode mudar status: admin_onway, administradora, sindico
const CAN_CHANGE_STATUS = ['admin_onway', 'administradora', 'sindico', 'subsindico'] as const

// Transições permitidas a partir de cada status
const ALLOWED_TRANSITIONS: Record<StatusOcorrencia, StatusOcorrencia[]> = {
  aberta: ['em_analise', 'arquivada', 'cancelada'],
  em_analise: ['arquivada', 'virou_multa', 'cancelada'],
  arquivada: ['em_analise'],
  virou_multa: [], // imutável depois que virou multa (a multa em si tem outro fluxo)
  cancelada: [],
}

export default function OcorrenciaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const canDelete = isGestor(perfil?.role)

  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [multaVinculada, setMultaVinculada] = useState<Multa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  // Edição inline de Unidade/Local
  const [editingDados, setEditingDados] = useState(false)
  const [unidadesList, setUnidadesList] = useState<Unidade[]>([])
  const [editUnidadeId, setEditUnidadeId] = useState<string>('')
  const [editLocal, setEditLocal] = useState<string>('')
  const [savingDados, setSavingDados] = useState(false)

  // Comentário da gestão
  const [editingComentario, setEditingComentario] = useState(false)
  const [comentarioDraft, setComentarioDraft] = useState('')
  const [savingComentario, setSavingComentario] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const o = await getOcorrencia(id)
      if (!o) {
        setError('Ocorrência não encontrada.')
        setLoading(false)
        return
      }
      setOcorrencia(o)

      // Carrega relacionados em paralelo
      const [un, pe, co, fu, mu] = await Promise.all([
        o.unidade_id ? getUnidade(o.unidade_id) : Promise.resolve(null),
        o.pessoa_envolvida_id ? getPessoa(o.pessoa_envolvida_id) : Promise.resolve(null),
        getCondominio(o.condominio_id),
        o.foto_url ? getOcorrenciaFotoSignedUrl(o.foto_url, 3600) : Promise.resolve(null),
        o.status === 'virou_multa' ? getMultaByOcorrencia(o.id) : Promise.resolve(null),
      ])
      setUnidade(un)
      setPessoa(pe)
      setCondominio(co)
      setFotoUrl(fu)
      setMultaVinculada(mu)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function startEditDados() {
    if (!ocorrencia) return
    setEditUnidadeId(ocorrencia.unidade_id ?? '')
    setEditLocal(ocorrencia.local ?? '')
    setEditingDados(true)
    // carrega lista de unidades sob demanda
    if (unidadesList.length === 0) {
      listUnidades({ condominio_id: ocorrencia.condominio_id, ativo: true })
        .then(setUnidadesList)
        .catch((e) => console.warn('[ocorrencia] listUnidades falhou:', e?.message))
    }
  }

  async function saveDados() {
    if (!ocorrencia) return
    setSavingDados(true)
    try {
      await updateOcorrencia(ocorrencia.id, {
        unidade_id: editUnidadeId || null,
        local: editLocal,
      })
      setEditingDados(false)
      await load()
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : '')
    } finally {
      setSavingDados(false)
    }
  }

  function startEditComentario() {
    if (!ocorrencia) return
    setComentarioDraft(ocorrencia.comentario_gestao ?? '')
    setEditingComentario(true)
  }

  async function saveComentario() {
    if (!ocorrencia) return
    setSavingComentario(true)
    try {
      const updated = await updateOcorrencia(ocorrencia.id, {
        comentario_gestao: comentarioDraft,
      })
      setOcorrencia(updated)
      setEditingComentario(false)
      toast.success('Comentário salvo.')
    } catch (e) {
      toast.error('Erro ao salvar comentário', e instanceof Error ? e.message : '')
    } finally {
      setSavingComentario(false)
    }
  }

  async function handleChangeStatus(newStatus: StatusOcorrencia) {
    if (!ocorrencia) return
    const ok = await confirm({ message: `Mudar status para "${STATUS_LABEL[newStatus]}"?` })
    if (!ok) return
    setChanging(true)
    try {
      await updateOcorrenciaStatus(ocorrencia.id, newStatus)
      await load()
    } catch (e) {
      toast.error('Erro ao mudar status', e instanceof Error ? e.message : '')
    } finally {
      setChanging(false)
    }
  }

  async function handleDelete() {
    if (!ocorrencia) return
    const ok = await confirm({
      title: 'Excluir ocorrência',
      message: 'Excluir essa ocorrência DEFINITIVAMENTE? Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    setChanging(true)
    try {
      await deleteOcorrencia(ocorrencia.id)
      toast.success('Ocorrência excluída.')
      navigate('/ocorrencias')
    } catch (e) {
      toast.error('Erro ao excluir', e instanceof Error ? e.message : '')
      setChanging(false)
    }
  }

  if (loading) {
    return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>
  }

  if (error || !ocorrencia) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader
          title="Ocorrência"
          actions={
            <Link to="/ocorrencias">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          }
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const canChangeStatus = perfil && (CAN_CHANGE_STATUS as readonly string[]).includes(perfil.role)
  const canGenerateMulta = canChangeStatus && ['aberta', 'em_analise'].includes(ocorrencia.status)
  const transitions = ALLOWED_TRANSITIONS[ocorrencia.status]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Ocorrência"
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={changing} />
            )}
            <Link to="/ocorrencias">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="text-sm text-slate-400">
            {new Date(ocorrencia.created_at).toLocaleString('pt-BR', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </div>
          <span
            className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[ocorrencia.status]}`}
          >
            {STATUS_LABEL[ocorrencia.status]}
          </span>
        </div>

        {!editingDados ? (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm mb-3">
              <dt className="text-slate-500">Condomínio</dt>
              <dd className="text-slate-200">{condominio?.nome ?? '—'}</dd>

              <dt className="text-slate-500">Unidade</dt>
              <dd className="text-slate-200">
                {unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : 'Área comum'}
              </dd>

              <dt className="text-slate-500">Local</dt>
              <dd className="text-slate-200">{ocorrencia.local || <span className="text-slate-500 italic">—</span>}</dd>

              {pessoa && (
                <>
                  <dt className="text-slate-500">Pessoa envolvida</dt>
                  <dd className="text-slate-200">{pessoa.nome}</dd>
                </>
              )}
            </dl>
            {canChangeStatus && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={startEditDados}
                  className="text-xs text-sky-400 hover:underline"
                >
                  ✎ Editar unidade / local
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mb-6 rounded-md border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Unidade</label>
              <select
                value={editUnidadeId}
                onChange={(e) => setEditUnidadeId(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="">— Área comum / sem unidade —</option>
                {unidadesList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Local</label>
              <input
                value={editLocal}
                onChange={(e) => setEditLocal(e.target.value)}
                placeholder="Ex.: Garagem, Hall, Piscina..."
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveDados} disabled={savingDados}>
                {savingDados ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="ghost" onClick={() => setEditingDados(false)} disabled={savingDados}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="border-t border-slate-800 pt-5">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Descrição
          </div>
          <p className="text-slate-100 whitespace-pre-wrap">{ocorrencia.descricao}</p>
        </div>

        {fotoUrl && (
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Foto
            </div>
            <a href={fotoUrl} target="_blank" rel="noreferrer" className="block max-w-md">
              <img
                src={fotoUrl}
                alt="Foto da ocorrência"
                className="w-full h-auto rounded-md border border-slate-800 hover:opacity-90 transition"
              />
            </a>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Comentário da gestão
            </div>
            {canChangeStatus && !editingComentario && (
              <button
                type="button"
                onClick={startEditComentario}
                className="text-xs text-sky-400 hover:underline"
              >
                {ocorrencia.comentario_gestao ? '✎ Editar' : '+ Adicionar'}
              </button>
            )}
          </div>
          {!editingComentario ? (
            ocorrencia.comentario_gestao ? (
              <p className="text-sm text-slate-200 whitespace-pre-wrap">
                {ocorrencia.comentario_gestao}
              </p>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Sem comentários. O agente de análise usa este campo como contexto adicional ao analisar.
              </p>
            )
          ) : (
            <div className="space-y-2">
              <textarea
                value={comentarioDraft}
                onChange={(e) => setComentarioDraft(e.target.value)}
                rows={4}
                placeholder="Ex.: morador reincidente, último aviso foi em jan/26, considerar agravante..."
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-sky-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <Button onClick={saveComentario} disabled={savingComentario}>
                  {savingComentario ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button variant="ghost" onClick={() => setEditingComentario(false)} disabled={savingComentario}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AIAnalysisPanel
        ocorrenciaId={ocorrencia.id}
        createdAt={ocorrencia.created_at}
        canAnalyse={!!canChangeStatus}
        canGenerateMulta={!!canGenerateMulta}
      />

      {canGenerateMulta && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-200 mb-1">Decidir o desfecho</div>
          <div className="text-xs text-slate-400 mb-3">
            Toda ocorrência começa por uma notificação à unidade. Depois da ciência/contestação, você decide multa, advertência, arquivar ou cancelar na tela da notificação.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to={`/notificacoes/nova?ocorrencia=${ocorrencia.id}&fromIA=1`} className="block sm:col-span-2">
              <div className="rounded-md border border-brand-500/50 bg-brand-500/5 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition h-full">
                <div className="text-sm font-semibold text-slate-100">📋 Gerar notificação</div>
                <div className="text-xs text-slate-400 mt-1">Notifica a unidade. A decisão (multa/advertência) vem depois, na notificação.</div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => handleChangeStatus('arquivada' as StatusOcorrencia)}
              className="block text-left"
            >
              <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition h-full">
                <div className="text-sm font-semibold text-slate-100">📦 Arquivar</div>
                <div className="text-xs text-slate-400 mt-1">Sem ação necessária. Fica registrada no histórico.</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleChangeStatus('cancelada' as StatusOcorrencia)}
              className="block text-left"
            >
              <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition h-full">
                <div className="text-sm font-semibold text-slate-100">✕ Cancelar</div>
                <div className="text-xs text-slate-400 mt-1">Registro inválido ou duplicado.</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {ocorrencia.status === 'virou_multa' && multaVinculada && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-5">
          <div className="text-sm font-medium text-red-200 mb-1">Multa gerada</div>
          <dl className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500">Valor</dt>
            <dd className="text-slate-100 font-medium">R$ {multaVinculada.valor.toFixed(2).replace('.', ',')}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd className="text-slate-200 capitalize">{multaVinculada.status.replace('_', ' ')}</dd>
            {multaVinculada.artigo_regimento && (
              <>
                <dt className="text-slate-500">Artigo</dt>
                <dd className="text-slate-200">{multaVinculada.artigo_regimento}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {canChangeStatus && transitions.length > 0 && !canGenerateMulta && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-300 mb-3">Mudar status para:</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((s) => (
              <Button
                key={s}
                variant="secondary"
                onClick={() => handleChangeStatus(s)}
                disabled={changing}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
