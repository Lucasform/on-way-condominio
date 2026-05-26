import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getConversa,
  listMensagens,
  enviarMensagem,
  mudarStatusConversa,
  ASSUNTO_LABEL,
  STATUS_LABEL,
} from '../lib/chat'
import { supabase } from '../lib/supabase'
import type { Conversa, Mensagem, StatusConversa } from '../types/chat'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'

const STATUS_CLASS: Record<StatusConversa, string> = {
  aberta: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  aguardando_humano: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_atendimento: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  encerrada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

export default function ChatConversa() {
  const { id } = useParams()
  const { user, perfil } = useAuth()
  const isMorador = perfil?.role === 'morador'
  const isStaff = perfil && ['admin_onway', 'administradora', 'sindico'].includes(perfil.role)

  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [novaMsg, setNovaMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const [c, m] = await Promise.all([getConversa(id), listMensagens(id)])
      if (!c) {
        setError('Conversa não encontrada.')
      } else {
        setConversa(c)
        setMensagens(m)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Realtime: novas mensagens
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${id}` },
        (payload) => {
          setMensagens((prev) => [...prev, payload.new as Mensagem])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversas', filter: `id=eq.${id}` },
        (payload) => {
          setConversa(payload.new as Conversa)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // Auto-scroll pro final ao chegar mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function handleEnviar(e: FormEvent) {
    e.preventDefault()
    if (!user || !id || !novaMsg.trim() || !conversa) return
    setEnviando(true)
    try {
      await enviarMensagem({
        conversa_id: id,
        autor_id: user.id,
        autor_tipo: isMorador ? 'morador' : 'staff',
        conteudo: novaMsg,
      })
      setNovaMsg('')
      // Se staff respondeu uma conversa "aguardando", marca como em_atendimento
      if (isStaff && conversa.status === 'aguardando_humano') {
        await mudarStatusConversa(id, 'em_atendimento')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  async function handleEncerrar() {
    if (!id) return
    if (!window.confirm('Encerrar esta conversa?')) return
    try {
      await mudarStatusConversa(id, 'encerrada')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  if (error || !conversa) {
    return (
      <div className="px-8 py-10 max-w-3xl mx-auto">
        <PageHeader
          title="Conversa"
          actions={<Link to="/chat"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const podeEnviar = conversa.status !== 'encerrada' && (isMorador || isStaff)

  return (
    <div className="px-8 py-8 max-w-3xl flex flex-col h-[calc(100vh-3rem)]">
      <PageHeader
        title={ASSUNTO_LABEL[conversa.assunto]}
        actions={
          <div className="flex items-center gap-2">
            <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[conversa.status]}`}>
              {STATUS_LABEL[conversa.status]}
            </span>
            <Link to="/chat">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
        }
      />

      {/* Thread */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        {mensagens.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">Sem mensagens.</div>
        ) : (
          mensagens.map((m) => (
            <MensagemBubble key={m.id} mensagem={m} eMeuLado={Boolean(m.autor_id === user?.id || (isMorador && m.autor_tipo === 'morador') || (isStaff && m.autor_tipo === 'staff'))} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input ou status terminal */}
      {podeEnviar ? (
        <form onSubmit={handleEnviar} className="mt-3 flex gap-2">
          <textarea
            value={novaMsg}
            onChange={(e) => setNovaMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEnviar(e as unknown as FormEvent)
            }}
            rows={2}
            placeholder="Digite sua mensagem... (Ctrl+Enter pra enviar)"
            className="flex-1 px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none text-sm text-slate-100 resize-none"
          />
          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={enviando || !novaMsg.trim()}>
              {enviando ? '...' : '➤'}
            </Button>
            {(isMorador || isStaff) && (
              <Button type="button" variant="ghost" onClick={handleEncerrar}>
                Encerrar
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-3 text-xs text-slate-500 italic text-center py-3 border-t border-slate-800">
          Conversa encerrada. {isMorador && 'Abra uma nova se precisar.'}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------

function MensagemBubble({ mensagem: m, eMeuLado }: { mensagem: Mensagem; eMeuLado: boolean }) {
  const isBot = m.autor_tipo === 'bot'
  const isSistema = m.autor_tipo === 'sistema'

  if (isSistema) {
    return (
      <div className="text-center text-[11px] text-slate-500 italic py-1">
        {m.conteudo}
      </div>
    )
  }

  const bubbleCls = eMeuLado
    ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-50 self-end'
    : isBot
    ? 'bg-purple-600/20 border border-purple-500/30 text-purple-50'
    : 'bg-slate-800 text-slate-100'

  const tipoLabel = isBot ? '🤖 Bot' : m.autor_tipo === 'morador' ? '👤 Morador' : '🏢 Administração'

  return (
    <div className={`flex ${eMeuLado ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 ${bubbleCls}`}>
        <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
          {tipoLabel} · {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <p className="text-sm whitespace-pre-wrap">{m.conteudo}</p>
      </div>
    </div>
  )
}
