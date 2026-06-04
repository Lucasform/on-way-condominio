import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getNotificacao,
  changeNotificacaoStatus,
  deleteNotificacao,
  NOTIFICACAO_STATUS_TRANSITIONS,
  NOTIFICACAO_STATUS_LABEL,
} from '../lib/notificacoes'
import { getUnidade } from '../lib/unidades'
import { getPessoa } from '../lib/pessoas'
import { getCondominio } from '../lib/condominios'
import type { Notificacao, StatusNotificacao } from '../types/notificacao'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { DetailSkeleton } from '../components/ui/Skeleton'
import { gerarPdfNotificacao } from '../lib/notificacaoPdf'
import DeleteButton from '../components/ui/DeleteButton'

const STATUS_CLASS: Record<StatusNotificacao, string> = {
  pendente:  'bg-amber-500/10 text-amber-300 border-amber-500/30',
  enviada:   'bg-sky-500/10 text-sky-300 border-sky-500/30',
  ciente:    'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  arquivada: 'bg-slate-700/40 text-slate-400 border-slate-700',
  cancelada: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

const CAN_CHANGE = ['admin_onway', 'administradora', 'sindico', 'subsindico'] as const

export default function NotificacaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [notificacao, setNotificacao] = useState<Notificacao | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const n = await getNotificacao(id)
      if (!n) { setError('Não encontrada.'); setLoading(false); return }
      setNotificacao(n)
      const [un, pe, co] = await Promise.all([
        getUnidade(n.unidade_id),
        n.pessoa_id ? getPessoa(n.pessoa_id) : Promise.resolve(null),
        getCondominio(n.condominio_id),
      ])
      setUnidade(un)
      setPessoa(pe)
      setCondominio(co)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  async function handleDelete() {
    if (!notificacao) return
    const ok = await confirm({
      title: 'Excluir notificação',
      message: 'Excluir esta notificação DEFINITIVAMENTE? Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    setChanging(true)
    try {
      await deleteNotificacao(notificacao.id)
      toast.success('Notificação excluída.')
      navigate('/notificacoes')
    } catch (e) {
      toast.error('Erro ao excluir', e instanceof Error ? e.message : '')
      setChanging(false)
    }
  }

  async function handleChange(novo: StatusNotificacao) {
    if (!notificacao) return
    const ok = await confirm({ message: `Mudar status para "${NOTIFICACAO_STATUS_LABEL[novo]}"?` })
    if (!ok) return
    setChanging(true)
    try {
      const updated = await changeNotificacaoStatus(notificacao.id, novo)
      setNotificacao(updated)
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setChanging(false)
    }
  }

  if (loading) return <DetailSkeleton />
  if (!notificacao) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10">
        <div className="text-red-400">{error ?? 'Não encontrada.'}</div>
      </div>
    )
  }

  const canChange = perfil && (CAN_CHANGE as readonly string[]).includes(perfil.role)
  const canDelete = isGestor(perfil?.role)
  const transitions = NOTIFICACAO_STATUS_TRANSITIONS[notificacao.status]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Notificação"
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={changing} />
            )}
            <Button
              variant="secondary"
              onClick={() => condominio && gerarPdfNotificacao({
                notificacao,
                unidade,
                pessoa,
                condominio,
                assinaturaUrl: perfil?.assinatura_url ?? null,
                emissorNome: perfil?.nome_exibicao ?? null,
              }).catch((e) => toast.error('Erro no PDF', e.message))}
              disabled={!condominio}
              title="Gerar PDF"
            >
              📄 Gerar PDF
            </Button>
            <Link to="/notificacoes"><Button variant="ghost">← Voltar</Button></Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-xl font-semibold text-slate-100">{notificacao.assunto}</div>
            <div className="text-xs text-slate-500 mt-1">
              Emitida em {new Date(notificacao.created_at).toLocaleString('pt-BR')}
            </div>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded text-sm border ${STATUS_CLASS[notificacao.status]}`}>
            {NOTIFICACAO_STATUS_LABEL[notificacao.status]}
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm mb-5">
          <dt className="text-slate-500">Condomínio</dt>
          <dd className="text-slate-200">{condominio?.nome ?? '—'}</dd>

          <dt className="text-slate-500">Unidade</dt>
          <dd className="text-slate-200">
            {unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'}
          </dd>

          {pessoa && (
            <>
              <dt className="text-slate-500">Pessoa</dt>
              <dd className="text-slate-200">{pessoa.nome}</dd>
            </>
          )}

          {notificacao.artigo_regimento && (
            <>
              <dt className="text-slate-500">Artigo</dt>
              <dd className="text-slate-200">{notificacao.artigo_regimento}</dd>
            </>
          )}

          {notificacao.data_envio && (
            <>
              <dt className="text-slate-500">Enviada em</dt>
              <dd className="text-slate-200">{new Date(notificacao.data_envio).toLocaleString('pt-BR')}</dd>
            </>
          )}
          {notificacao.data_ciencia && (
            <>
              <dt className="text-slate-500">Ciência em</dt>
              <dd className="text-slate-200">{new Date(notificacao.data_ciencia).toLocaleString('pt-BR')}</dd>
            </>
          )}
        </dl>

        <div className="border-t border-slate-800 pt-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Descrição</div>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{notificacao.descricao}</p>
        </div>

        {notificacao.observacoes && (
          <div className="border-t border-slate-800 pt-4 mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Observações internas</div>
            <p className="text-sm text-slate-400 whitespace-pre-wrap">{notificacao.observacoes}</p>
          </div>
        )}
      </div>

      {canChange && transitions.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-200 mb-3">Mudar status para:</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((s) => (
              <Button key={s} variant="secondary" onClick={() => handleChange(s)} disabled={changing}>
                {NOTIFICACAO_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
