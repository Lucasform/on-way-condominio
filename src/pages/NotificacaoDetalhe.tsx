import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getNotificacao,
  changeNotificacaoStatus,
  deleteNotificacao,
  aplicarAdvertencia,
  NOTIFICACAO_STATUS_TRANSITIONS,
  NOTIFICACAO_STATUS_LABEL,
  NOTIFICACAO_STATUS_TERMINAL,
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
import Modal from '../components/ui/Modal'
import { DetailSkeleton } from '../components/ui/Skeleton'
import { gerarPdfNotificacao } from '../lib/notificacaoPdf'
import { enviarNotificacaoMulticanal, type CanaisEnvio } from '../lib/enviarNotificacao'
import DeleteButton from '../components/ui/DeleteButton'
import ContestacaoThread from '../components/ContestacaoThread'

const STATUS_CLASS: Record<StatusNotificacao, string> = {
  pendente:     'bg-amber-500/10 text-amber-300 border-amber-500/30',
  enviada:      'bg-sky-500/10 text-sky-300 border-sky-500/30',
  ciente:       'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  contestada:   'bg-orange-500/10 text-orange-300 border-orange-500/30',
  advertencia:  'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  multa_gerada: 'bg-red-500/10 text-red-300 border-red-500/30',
  arquivada:    'bg-slate-700/40 text-slate-400 border-slate-700',
  cancelada:    'bg-slate-700/40 text-slate-500 border-slate-700',
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
  const [enviarOpen, setEnviarOpen] = useState(false)
  const [canais, setCanais] = useState<CanaisEnvio>({ email: true, whatsapp: true })

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

  async function handleEnviar() {
    if (!notificacao || !condominio) return
    if (!canais.email && !canais.whatsapp) {
      toast.warning('Escolha um canal', 'Marque e-mail e/ou WhatsApp para enviar.')
      return
    }
    setEnviarOpen(false)
    setChanging(true)
    try {
      const r = await enviarNotificacaoMulticanal({
        notificacao, pessoa, unidade, condominio,
        assinaturaUrl: perfil?.assinatura_url ?? null,
        emissorNome: perfil?.nome_exibicao ?? null,
        canais,
      })
      const partes = [
        canais.email ? (r.email === 'ok' ? 'e-mail ✓' : r.email === 'sem_email' ? 'sem e-mail' : 'e-mail ✕') : null,
        canais.whatsapp ? (r.whatsapp === 'ok' ? 'WhatsApp ✓' : r.whatsapp === 'sem_whatsapp' ? 'sem WhatsApp'
          : r.whatsapp === 'inativo' ? 'WhatsApp desconectado' : 'WhatsApp ✕') : null,
        ...(r.app ? ['app ✓'] : []),
      ].filter(Boolean) as string[]
      if (r.entregue) {
        toast.success('Notificação enviada', partes.join(' · '))
      } else {
        toast.warning('Registrada, mas sem canal', 'A pessoa não tem e-mail, telefone nem acesso ao app. Cadastre um contato.')
      }
      const u = await getNotificacao(notificacao.id)
      if (u) setNotificacao(u)
    } catch (e) {
      toast.error('Erro ao enviar', e instanceof Error ? e.message : '')
    } finally {
      setChanging(false)
    }
  }

  async function handleAdvertencia() {
    if (!notificacao) return
    const ok = await confirm({
      title: 'Aplicar advertência?',
      message: 'Formaliza a advertência (sem valor financeiro) e encerra a notificação.',
      confirmText: 'Aplicar advertência',
    })
    if (!ok) return
    setChanging(true)
    try {
      const u = await aplicarAdvertencia(notificacao.id)
      setNotificacao(u)
      toast.success('Advertência aplicada')
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
            {canChange && !NOTIFICACAO_STATUS_TERMINAL.includes(notificacao.status) && (
              <Button onClick={() => setEnviarOpen(true)} disabled={changing} title="Escolher canais e enviar com o PDF">
                📧 Enviar
              </Button>
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

      <Modal
        open={enviarOpen}
        onClose={() => setEnviarOpen(false)}
        title="Enviar notificação"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnviarOpen(false)}>Cancelar</Button>
            <Button onClick={handleEnviar} disabled={!canais.email && !canais.whatsapp}>Enviar</Button>
          </>
        }
      >
        <p className="text-slate-400 mb-3">Escolha por onde enviar o PDF. O alerta no app vai sempre.</p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 cursor-pointer hover:bg-slate-800/40">
            <input
              type="checkbox"
              checked={canais.email}
              onChange={(e) => setCanais((c) => ({ ...c, email: e.target.checked }))}
              className="h-4 w-4 accent-sky-500"
            />
            <span className="flex-1">📧 E-mail</span>
            <span className="text-xs text-slate-500">{pessoa?.email ?? 'sem e-mail cadastrado'}</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 cursor-pointer hover:bg-slate-800/40">
            <input
              type="checkbox"
              checked={canais.whatsapp}
              onChange={(e) => setCanais((c) => ({ ...c, whatsapp: e.target.checked }))}
              className="h-4 w-4 accent-emerald-500"
            />
            <span className="flex-1">💬 WhatsApp</span>
            <span className="text-xs text-slate-500">{pessoa?.telefone ?? 'sem telefone cadastrado'}</span>
          </label>
        </div>
      </Modal>

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

      {canChange && !NOTIFICACAO_STATUS_TERMINAL.includes(notificacao.status) && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-200 mb-1">Decidir o desfecho</div>
          <div className="text-xs text-slate-400 mb-3">
            Depois da ciência/contestação da unidade, escolha a sanção.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to={`/multas/nova?ocorrencia=${notificacao.ocorrencia_id ?? ''}&notificacao=${notificacao.id}&fromIA=1`}
              className="block"
            >
              <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition h-full">
                <div className="text-sm font-semibold text-slate-100">💰 Gerar multa</div>
                <div className="text-xs text-slate-400 mt-1">Sanção com valor monetário conforme regimento.</div>
              </div>
            </Link>
            <button type="button" onClick={handleAdvertencia} disabled={changing} className="block text-left">
              <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition h-full">
                <div className="text-sm font-semibold text-slate-100">⚠ Gerar advertência</div>
                <div className="text-xs text-slate-400 mt-1">Advertência formal, sem valor financeiro.</div>
              </div>
            </button>
            <button type="button" onClick={() => handleChange('arquivada')} disabled={changing} className="block text-left">
              <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition h-full">
                <div className="text-sm font-semibold text-slate-100">📦 Arquivar</div>
                <div className="text-xs text-slate-400 mt-1">Sem sanção. Fica no histórico.</div>
              </div>
            </button>
            <button type="button" onClick={() => handleChange('cancelada')} disabled={changing} className="block text-left">
              <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 hover:border-brand-500 hover:bg-slate-800/60 transition h-full">
                <div className="text-sm font-semibold text-slate-100">✕ Cancelar</div>
                <div className="text-xs text-slate-400 mt-1">Registro inválido ou duplicado.</div>
              </div>
            </button>
          </div>
        </div>
      )}

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

      <ContestacaoThread notificacaoId={notificacao.id} pessoaUserId={pessoa?.user_id ?? null} />
    </div>
  )
}
