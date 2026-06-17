import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getSolicitacao,
  listMensagens,
  addMensagem,
  updateSolicitacaoStatus,
} from '../lib/solicitacoes'
import type { Solicitacao, SolicitacaoMensagem, StatusSolicitacao } from '../types/solicitacao'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Textarea } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'

const TIPO_LABEL: Record<string, string> = {
  duvida: 'Dúvida', reclamacao: 'Reclamação', sugestao: 'Sugestão', outros: 'Outros',
}

const STATUS_CONFIG: Record<StatusSolicitacao, { label: string; cls: string }> = {
  enviado:    { label: 'Enviado',     cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  analise:    { label: 'Em análise', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  respondido: { label: 'Respondido', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
}

const STATUS_FLOW: Record<StatusSolicitacao, StatusSolicitacao[]> = {
  enviado:    ['analise', 'respondido'],
  analise:    ['enviado', 'respondido'],
  respondido: ['analise'],
}

const STATUS_LABEL: Record<StatusSolicitacao, string> = {
  enviado: 'Enviado', analise: 'Em análise', respondido: 'Respondido',
}

export default function SolicitacaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const gestor = isGestor(perfil?.role)
  const toast = useToast()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null)
  const [mensagens, setMensagens] = useState<SolicitacaoMensagem[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const [s, msgs] = await Promise.all([getSolicitacao(id), listMensagens(id)])
      if (!s) { navigate('/solicitacoes', { replace: true }); return }
      setSolicitacao(s)
      setMensagens(msgs)
    } catch (e) {
      toast.error('Erro ao carregar', e instanceof Error ? e.message : '')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !id || !texto.trim()) return
    setSending(true)
    try {
      const msg = await addMensagem(id, user.id, texto.trim())
      setMensagens((prev) => [...prev, msg])
      setTexto('')

      // gestor respondendo → avança para 'respondido' automaticamente se ainda em 'enviado'
      if (gestor && solicitacao?.status === 'enviado') {
        await updateSolicitacaoStatus(id, 'respondido')
        setSolicitacao((prev) => prev ? { ...prev, status: 'respondido' } : prev)
      }
    } catch (e) {
      toast.error('Erro ao enviar mensagem', e instanceof Error ? e.message : '')
    } finally {
      setSending(false)
    }
  }

  async function handleStatus(status: StatusSolicitacao) {
    if (!id) return
    setUpdatingStatus(true)
    try {
      await updateSolicitacaoStatus(id, status)
      setSolicitacao((prev) => prev ? { ...prev, status } : prev)
      toast.success(`Status atualizado para "${STATUS_LABEL[status]}".`)
    } catch {
      toast.error('Erro ao atualizar status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
        <div className="text-sm text-slate-500">Carregando...</div>
      </div>
    )
  }

  if (!solicitacao) return null

  const { label: statusLabel, cls: statusCls } = STATUS_CONFIG[solicitacao.status]
  const transitions = gestor ? STATUS_FLOW[solicitacao.status] : []

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title={solicitacao.titulo}
        subtitle={`${TIPO_LABEL[solicitacao.tipo]} · ${solicitacao.autor_nome ?? 'Morador'}${solicitacao.unidade_nome ? ` · Unid. ${solicitacao.unidade_nome}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <span className={`text-xs border rounded-full px-3 py-0.5 ${statusCls}`}>{statusLabel}</span>
          </div>
        }
      />

      {/* Controles de status — apenas gestor */}
      {gestor && transitions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-slate-500 self-center">Mover para:</span>
          {transitions.map((s) => (
            <button
              key={s}
              onClick={() => handleStatus(s)}
              disabled={updatingStatus}
              className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition disabled:opacity-50"
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {/* Mensagem original */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mb-6">
        <p className="text-xs text-slate-500 mb-2">{fmtTs(solicitacao.created_at)} · Solicitação inicial</p>
        <p className="text-sm text-slate-200 whitespace-pre-wrap">{solicitacao.descricao}</p>
      </div>

      {/* Thread de mensagens */}
      {mensagens.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Histórico</h3>
          {mensagens.map((m) => {
            const isMe = m.autor_id === user?.id
            const ehGestor = m.autor_role && ['admin_onway','admin','administradora','sindico','subsindico'].includes(m.autor_role)

            return (
              <div
                key={m.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    isMe
                      ? 'bg-brand-600/20 border border-brand-600/30 text-brand-100'
                      : ehGestor
                      ? 'bg-emerald-600/10 border border-emerald-600/20 text-emerald-100'
                      : 'bg-slate-800 border border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold">
                      {m.autor_nome ?? 'Usuário'}
                    </span>
                    {ehGestor && (
                      <span className="text-[9px] bg-emerald-700/20 text-emerald-400 border border-emerald-700/30 rounded px-1">Gestão</span>
                    )}
                    <span className="text-[10px] text-slate-500 ml-auto">{fmtTs(m.criado_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Responder */}
      {(gestor || solicitacao.autor_id === user?.id) && solicitacao.status !== 'respondido' || gestor ? (
        <form onSubmit={handleEnviar} className="space-y-3">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={gestor ? 'Resposta da gestão...' : 'Adicionar informação...'}
            rows={4}
          />
          <div className="flex gap-3">
            <Button type="submit" disabled={sending || !texto.trim()}>
              {sending ? 'Enviando...' : 'Enviar mensagem'}
            </Button>
            <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => navigate(-1)}>← Voltar</Button>
      )}
    </div>
  )
}

function fmtTs(iso: string): string {
  try { return new Date(iso).toLocaleString('pt-BR') } catch { return '' }
}
