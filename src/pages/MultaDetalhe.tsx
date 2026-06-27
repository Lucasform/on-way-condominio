import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getMulta,
  changeMultaStatus,
  deleteMulta,
  listMultaStatusLog,
  updateMultaVencimento,
  MULTA_STATUS_TRANSITIONS,
  MULTA_STATUS_LABEL,
} from '../lib/multas'
import { getUnidade } from '../lib/unidades'
import { getPessoa } from '../lib/pessoas'
import { getCondominio } from '../lib/condominios'
import type { Multa, MultaStatusLog, StatusMulta } from '../types/multa'
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
import ContestacaoThread from '../components/ContestacaoThread'
import DeleteButton from '../components/ui/DeleteButton'
import { gerarPdfNotificacao } from '../lib/multaPdf'
import { gerarPdfRecibo } from '../lib/multaReciboPdf'
import { ensureWaConversa, sendWaMessage } from '../lib/whatsappInbox'

const STATUS_CLASS: Record<StatusMulta, string> = {
  pendente_aprovacao: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  em_analise: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  aplicada: 'bg-red-500/10 text-red-300 border-red-500/30',
  paga: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  contestada: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  cancelada: 'bg-slate-700/40 text-slate-500 border-slate-700',
  arquivada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

const CAN_CHANGE = ['admin_onway', 'administradora', 'sindico', 'subsindico'] as const

export default function MultaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [multa, setMulta] = useState<Multa | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [timeline, setTimeline] = useState<MultaStatusLog[]>([])
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)
  const [editVenc, setEditVenc] = useState(false)
  const [vencInput, setVencInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const m = await getMulta(id)
      if (!m) {
        setError('Multa não encontrada.')
        setLoading(false)
        return
      }
      setMulta(m)
      setVencInput(m.vencimento_em ?? '')
      const [un, pe, co, log] = await Promise.all([
        getUnidade(m.unidade_id),
        m.pessoa_id ? getPessoa(m.pessoa_id) : Promise.resolve(null),
        getCondominio(m.condominio_id),
        listMultaStatusLog(m.id).catch(() => [] as MultaStatusLog[]),
      ])
      setUnidade(un)
      setPessoa(pe)
      setCondominio(co)
      setTimeline(log)
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

  async function handleDelete() {
    if (!multa) return
    const ok = await confirm({
      title: 'Excluir multa',
      message: 'Excluir esta multa DEFINITIVAMENTE? Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    setChanging(true)
    try {
      await deleteMulta(multa.id)
      toast.success('Multa excluída.')
      navigate('/multas')
    } catch (e) {
      toast.error('Erro ao excluir', e instanceof Error ? e.message : '')
      setChanging(false)
    }
  }

  async function handleChange(newStatus: StatusMulta) {
    if (!multa) return
    const ok = await confirm({
      message: `Mudar status para "${MULTA_STATUS_LABEL[newStatus]}"?`,
    })
    if (!ok) return
    setChanging(true)
    try {
      await changeMultaStatus(multa.id, newStatus)
      await load()
      // Ao quitar, oferece o recibo na hora
      if (newStatus === 'paga' && condominio) {
        try {
          await gerarPdfRecibo({
            multa: { ...multa, status: 'paga', data_pagamento: new Date().toISOString().slice(0, 10) },
            unidade,
            pessoa,
            condominio,
            assinaturaUrl: perfil?.assinatura_url ?? null,
            emissorNome: perfil?.nome_exibicao ?? null,
          })
        } catch (e) {
          console.warn('Recibo falhou:', e)
        }
      }
    } catch (e) {
      toast.error('Erro ao mudar status', e instanceof Error ? e.message : '')
    } finally {
      setChanging(false)
    }
  }

  async function handleSalvarVencimento() {
    if (!multa) return
    setChanging(true)
    try {
      await updateMultaVencimento(multa.id, vencInput || null)
      setEditVenc(false)
      await load()
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : '')
    } finally {
      setChanging(false)
    }
  }

  if (loading) return <DetailSkeleton />

  if (error || !multa) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader
          title="Multa"
          actions={<Link to="/multas"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const canChange = perfil && (CAN_CHANGE as readonly string[]).includes(perfil.role)
  const canDelete = isGestor(perfil?.role)

  async function handleAvisarWhatsApp() {
    if (!multa || !pessoa?.telefone || !user) return
    setChanging(true)
    try {
      const conv = await ensureWaConversa({
        condominio_id: multa.condominio_id,
        telefone: pessoa.telefone,
        contato_nome: pessoa.nome,
        pessoa_id: pessoa.id,
        unidade_id: multa.unidade_id,
      })
      const venc = multa.vencimento_em ? new Date(multa.vencimento_em).toLocaleDateString('pt-BR') : null
      const valorFmt = `R$ ${Number(multa.valor).toFixed(2).replace('.', ',')}`
      const texto =
        `*OnWay Condomínio*\n\nLembrete de multa em seu nome.\n` +
        `*Valor:* ${valorFmt}\n` +
        (venc ? `*Vencimento:* ${venc}\n` : '') +
        (multa.artigo_regimento ? `*Base:* ${multa.artigo_regimento}\n` : '') +
        `\nVocê pode acompanhar e regularizar pelo app. Dúvidas, fale com a administração.`
      const r = await sendWaMessage({ conversa: conv, texto, autor_id: user.id })
      if (r.skipped) toast.error('WhatsApp inativo', 'Conecte o WhatsApp do condomínio antes de avisar.')
      else if (r.ok) toast.success('Aviso enviado', 'Mensagem registrada no WhatsApp do morador.')
      else toast.error('Falha', 'Não foi possível enviar.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setChanging(false)
    }
  }
  const transitions = MULTA_STATUS_TRANSITIONS[multa.status]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Multa"
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={changing} />
            )}
            <Button
              variant="secondary"
              onClick={() => condominio && gerarPdfNotificacao({
                multa,
                unidade,
                pessoa,
                condominio,
                assinaturaUrl: perfil?.assinatura_url ?? null,
                emissorNome: perfil?.nome_exibicao ?? null,
              }).catch((e) => toast.error('Erro no PDF', e.message))}
              disabled={!condominio}
              title="Gerar PDF de notificação"
            >
              📄 Notificação
            </Button>
            {multa.status === 'paga' && (
              <Button
                variant="secondary"
                onClick={() => condominio && gerarPdfRecibo({
                  multa,
                  unidade,
                  pessoa,
                  condominio,
                  assinaturaUrl: perfil?.assinatura_url ?? null,
                  emissorNome: perfil?.nome_exibicao ?? null,
                }).catch((e) => toast.error('Erro no PDF', e.message))}
                disabled={!condominio}
                title="Recibo de quitação"
              >
                ✓ Recibo
              </Button>
            )}
            {canChange && pessoa?.telefone && (
              <Button
                variant="secondary"
                onClick={handleAvisarWhatsApp}
                disabled={changing}
                title="Enviar lembrete por WhatsApp ao morador"
              >
                📱 Avisar no WhatsApp
              </Button>
            )}
            <Link to="/multas"><Button variant="ghost">← Voltar</Button></Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-3xl font-bold text-slate-100">
              R$ {Number(multa.valor).toFixed(2).replace('.', ',')}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Registrada em {new Date(multa.created_at).toLocaleString('pt-BR')}
            </div>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded text-sm border ${STATUS_CLASS[multa.status]}`}>
            {MULTA_STATUS_LABEL[multa.status]}
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm mb-5">
          <dt className="text-slate-500">Condomínio</dt>
          <dd className="text-slate-200">{condominio?.nome ?? '—'}</dd>

          <dt className="text-slate-500">Unidade</dt>
          <dd className="text-slate-200">
            {unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'}
            {unidade && (
              <Link to={`/unidades/${unidade.id}/historico`} className="ml-3 text-xs text-emerald-400 hover:underline">
                ver histórico →
              </Link>
            )}
          </dd>

          {pessoa && (
            <>
              <dt className="text-slate-500">Pessoa</dt>
              <dd className="text-slate-200">{pessoa.nome}</dd>
            </>
          )}

          {multa.artigo_regimento && (
            <>
              <dt className="text-slate-500">Artigo</dt>
              <dd className="text-slate-200">{multa.artigo_regimento}</dd>
            </>
          )}

          {multa.data_aplicacao && (
            <>
              <dt className="text-slate-500">Aplicada em</dt>
              <dd className="text-slate-200">{new Date(multa.data_aplicacao).toLocaleDateString('pt-BR')}</dd>
            </>
          )}

          {multa.data_pagamento && (
            <>
              <dt className="text-slate-500">Paga em</dt>
              <dd className="text-slate-200">{new Date(multa.data_pagamento).toLocaleDateString('pt-BR')}</dd>
            </>
          )}

          <dt className="text-slate-500">Vencimento</dt>
          <dd className="text-slate-200">
            {editVenc ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={vencInput}
                  onChange={(e) => setVencInput(e.target.value)}
                  onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100"
                />
                <Button size="sm" onClick={handleSalvarVencimento} disabled={changing}>Salvar</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditVenc(false); setVencInput(multa.vencimento_em ?? '') }}>cancelar</Button>
              </div>
            ) : (
              <span className={vencimentoClass(multa.vencimento_em, multa.status)}>
                {multa.vencimento_em ? new Date(multa.vencimento_em + 'T00:00:00').toLocaleDateString('pt-BR') : 'não definido'}
                {canChange && (
                  <button
                    onClick={() => setEditVenc(true)}
                    className="ml-3 text-xs text-slate-500 hover:text-slate-200"
                  >
                    ✎ editar
                  </button>
                )}
              </span>
            )}
          </dd>

          {multa.ocorrencia_id && (
            <>
              <dt className="text-slate-500">Ocorrência</dt>
              <dd>
                <Link to={`/ocorrencias/${multa.ocorrencia_id}`} className="text-emerald-400 hover:underline">
                  ver ocorrência origem →
                </Link>
              </dd>
            </>
          )}
        </dl>

        <div className="border-t border-slate-800 pt-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Descrição</div>
          <p className="text-slate-100 whitespace-pre-wrap">{multa.descricao}</p>
        </div>

        {multa.observacoes && (
          <div className="border-t border-slate-800 pt-4 mt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Observações internas
            </div>
            <p className="text-slate-300 whitespace-pre-wrap text-sm">{multa.observacoes}</p>
          </div>
        )}
      </div>

      {/* W1 SoD: aprovação por outro gestor */}
      {canChange && multa.status === 'pendente_aprovacao' && (
        multa.criado_por === user?.id ? (
          <div className="mt-6 rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
            <div className="text-sm font-medium text-violet-200 mb-1">Aguardando aprovação</div>
            <p className="text-xs text-slate-400">
              Você registrou esta multa. Por segregação de função, outro gestor precisa aprová-la antes de ela seguir o fluxo.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
            <div className="text-sm font-medium text-violet-200 mb-1">Aprovar multa</div>
            <p className="text-xs text-slate-400 mb-3">
              Esta multa foi registrada por outro gestor e aguarda sua revisão.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleChange('em_analise')} disabled={changing}>
                Aprovar — seguir para análise
              </Button>
              <Button variant="secondary" onClick={() => handleChange('cancelada')} disabled={changing}>
                Recusar e cancelar
              </Button>
            </div>
          </div>
        )
      )}

      {canChange && multa.status === 'contestada' && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="text-sm font-medium text-amber-200 mb-1">Decidir a contestação</div>
          <p className="text-xs text-slate-400 mb-3">
            O morador contestou esta multa. Responda na conversa abaixo e registre a decisão.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleChange('aplicada')} disabled={changing}>
              Manter decisão (segue aplicada)
            </Button>
            <Button variant="secondary" onClick={() => handleChange('cancelada')} disabled={changing}>
              Acatar contestação (cancelar multa)
            </Button>
          </div>
        </div>
      )}

      {canChange && multa.status !== 'contestada' && transitions.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-300 mb-3">Mudar status para:</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((s) => (
              <Button
                key={s}
                variant="secondary"
                onClick={() => handleChange(s)}
                disabled={changing}
              >
                {MULTA_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {canChange && transitions.length === 0 && (
        <div className="mt-6 text-xs text-slate-500">
          Status terminal — nenhuma transição disponível.
        </div>
      )}

      {timeline.length > 0 && (
        <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-slate-100 mb-3">Histórico de status</h3>
          <ol className="space-y-2">
            {timeline.map((t) => (
              <li key={t.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1 inline-block w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-200">
                    {t.status_anterior
                      ? <>{MULTA_STATUS_LABEL[t.status_anterior]} → <strong>{MULTA_STATUS_LABEL[t.status_novo]}</strong></>
                      : <>Criada como <strong>{MULTA_STATUS_LABEL[t.status_novo]}</strong></>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ContestacaoThread
        multaId={multa.id}
        pessoaUserId={pessoa?.user_id ?? null}
      />

    </div>
  )
}

function vencimentoClass(venc: string | null, status: StatusMulta): string {
  if (!venc) return 'text-slate-500'
  if (status === 'paga' || status === 'cancelada' || status === 'arquivada') return 'text-slate-200'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(venc + 'T00:00:00')
  const diff = (d.getTime() - today.getTime()) / 86400_000
  if (diff < 0) return 'text-red-400 font-medium'
  if (diff <= 3) return 'text-amber-300 font-medium'
  return 'text-slate-200'
}

