import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getConversa,
  listMensagens,
  enviarMensagem,
  mudarStatusConversa,
  deleteConversa,
  atribuirConversa,
  marcarMensagensLidas,
  listStaffCondominio,
  ASSUNTO_LABEL,
  STATUS_LABEL,
} from '../lib/chat'
import { supabase } from '../lib/supabase'
import type { Conversa, Mensagem, StatusConversa } from '../types/chat'
import { useAuth } from '../components/AuthProvider'
import { roleLabel } from '../lib/nav'
import type { Role } from '../types/database'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import TemplatePicker from '../components/TemplatePicker'

interface AutorInfo {
  nome: string
  sublabel: string  // "C-301" pra morador, "Síndico" pra staff
}

const STATUS_CLASS: Record<StatusConversa, string> = {
  aberta: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  aguardando_humano: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_atendimento: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  encerrada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

export default function ChatConversa() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isMorador = perfil?.role === 'morador'
  const isStaff = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)

  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [autores, setAutores] = useState<Map<string, AutorInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [novaMsg, setNovaMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sugerindo, setSugerindo] = useState(false)
  const [sugestaoErr, setSugestaoErr] = useState<string | null>(null)
  const [botDigitando, setBotDigitando] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  async function sugerirResposta() {
    if (!id) return
    setSugerindo(true)
    setSugestaoErr(null)
    try {
      const { data, error: e } = await supabase.functions.invoke('suggest-chat-reply', {
        body: { conversa_id: id },
      })
      if (e) throw e
      if (data?.error) throw new Error(data.error)
      if (typeof data?.sugestao === 'string') setNovaMsg(data.sugestao)
    } catch (e) {
      setSugestaoErr(e instanceof Error ? e.message : 'Erro ao sugerir resposta.')
    } finally {
      setSugerindo(false)
    }
  }

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
        // Marca como lidas em background (não bloqueia o render)
        if (user?.id) {
          marcarMensagensLidas(id, user.id).catch(() => {})
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  // Staff list for assignee
  const [staffList, setStaffList] = useState<Array<{ id: string; nome_exibicao: string | null; role: string }>>([])
  useEffect(() => {
    if (!conversa?.condominio_id || !isStaff) return
    listStaffCondominio(conversa.condominio_id).then(setStaffList).catch(() => {})
  }, [conversa?.condominio_id, isStaff])

  async function handleAtribuir(novoUserId: string | null) {
    if (!id) return
    try {
      await atribuirConversa(id, novoUserId)
      await load()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Resolve autor_id -> { nome, sublabel (unidade ou cargo) }
  // Inclui sempre o morador_user_id da conversa (mesmo que ele ainda nao tenha enviado mensagem).
  useEffect(() => {
    const setIds = new Set<string>()
    if (conversa?.morador_user_id) setIds.add(conversa.morador_user_id)
    for (const m of mensagens) {
      if (m.autor_id && m.autor_tipo !== 'bot' && m.autor_tipo !== 'sistema') {
        setIds.add(m.autor_id)
      }
    }
    const ids = Array.from(setIds)
    const pendentes = ids.filter((i) => !autores.has(i))
    if (pendentes.length === 0) return
    ;(async () => {
      const { data: perfis } = await supabase
        .from('perfis')
        .select('id, role, nome_exibicao, condominio_id')
        .in('id', pendentes)
      const moradorIds = (perfis ?? []).filter((p) => p.role === 'morador').map((p) => p.id)
      // unidades vem como array em PostgREST quando ha FK, achatamos pra primeiro elemento.
      type PessoaLite = {
        user_id: string | null
        nome: string
        unidade_id: string | null
        unidades: { bloco: string | null; numero: string } | { bloco: string | null; numero: string }[] | null
      }
      let pessoas: PessoaLite[] = []
      if (moradorIds.length > 0) {
        const { data } = await supabase
          .from('pessoas')
          .select('user_id, nome, unidade_id, unidades:unidade_id(bloco, numero)')
          .in('user_id', moradorIds)
        pessoas = (data ?? []) as PessoaLite[]
      }
      const pessoaPorUser = new Map<string, PessoaLite>()
      for (const p of pessoas) {
        if (p.user_id) pessoaPorUser.set(p.user_id, p)
      }

      setAutores((prev) => {
        const novo = new Map(prev)
        for (const pf of perfis ?? []) {
          if (pf.role === 'morador') {
            const ps = pessoaPorUser.get(pf.id)
            const u = Array.isArray(ps?.unidades) ? ps?.unidades[0] : ps?.unidades
            const unidadeLbl = u
              ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero)
              : null
            novo.set(pf.id, {
              nome: ps?.nome ?? pf.nome_exibicao ?? 'Morador',
              sublabel: unidadeLbl ? `Un. ${unidadeLbl}` : 'sem unidade',
            })
          } else {
            novo.set(pf.id, {
              nome: pf.nome_exibicao ?? 'Sem nome',
              sublabel: roleLabel(pf.role as Role),
            })
          }
        }
        return novo
      })
    })().catch((e) => console.warn('[chat] falha ao resolver autores:', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagens, conversa?.morador_user_id])

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

  // "Assistente digitando": última msg é do morador e o bot ainda vai responder.
  // Some quando o bot responde (mensagens muda) ou após 25s (caso o bot falhe).
  useEffect(() => {
    const ultima = mensagens[mensagens.length - 1]
    const ativo = !!ultima && ultima.autor_tipo === 'morador'
      && conversa?.status !== 'encerrada' && conversa?.status !== 'em_atendimento'
    if (!ativo) { setBotDigitando(false); return }
    setBotDigitando(true)
    const t = setTimeout(() => setBotDigitando(false), 25000)
    return () => clearTimeout(t)
  }, [mensagens, conversa?.status])

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
      toast.error('Erro ao enviar', e instanceof Error ? e.message : '')
    } finally {
      setEnviando(false)
    }
  }

  async function handleEncerrar() {
    if (!id) return
    const ok = await confirm({ message: 'Encerrar esta conversa?', confirmText: 'Encerrar' })
    if (!ok) return
    try {
      await mudarStatusConversa(id, 'encerrada')
      await load()
      toast.success('Conversa encerrada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  // Apagar conversa: so depois de encerrada e so admin geral ou sindico
  const podeApagarConversa =
    !!conversa
    && conversa.status === 'encerrada'
    && (perfil?.role === 'admin_onway' || perfil?.role === 'sindico' || perfil?.role === 'subsindico')

  async function handleApagarConversa() {
    if (!id || !conversa) return
    const ok = await confirm({
      title: 'Apagar conversa',
      message: 'Apagar esta conversa DEFINITIVAMENTE? Todas as mensagens serão removidas. Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Apagar',
    })
    if (!ok) return
    const ok2 = await confirm({
      title: 'Confirmar exclusão',
      message: 'Confirme novamente para apagar a conversa.',
      tone: 'danger',
      confirmText: 'Sim, apagar',
    })
    if (!ok2) return
    try {
      await deleteConversa(id)
      toast.success('Conversa apagada.')
      navigate('/chat')
    } catch (e) {
      toast.error('Erro ao apagar', e instanceof Error ? e.message : '')
    }
  }

  if (loading) return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>

  if (error || !conversa) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
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
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-3xl mx-auto flex flex-col h-[calc(100vh-3rem)]">
      <PageHeader
        title={ASSUNTO_LABEL[conversa.assunto]}
        subtitle={(() => {
          const solicitante = autores.get(conversa.morador_user_id)
          if (!solicitante) return undefined
          const assignee = conversa.atribuida_para
            ? (staffList.find((s) => s.id === conversa.atribuida_para)?.nome_exibicao ?? null)
            : null
          const base = `Solicitado por ${solicitante.nome}${solicitante.sublabel ? ` · ${solicitante.sublabel}` : ''}`
          return assignee ? `${base} · atribuída a ${assignee}` : base
        })()}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[conversa.status]}`}>
              {STATUS_LABEL[conversa.status]}
            </span>
            {isStaff && conversa.status !== 'encerrada' && (
              <div className="flex items-center gap-1">
                {conversa.atribuida_para !== user?.id && (
                  <Button size="sm" variant="secondary" onClick={() => handleAtribuir(user?.id ?? null)}>
                    Pegar pra mim
                  </Button>
                )}
                {staffList.length > 0 && (
                  <select
                    value={conversa.atribuida_para ?? ''}
                    onChange={(e) => handleAtribuir(e.target.value || null)}
                    className="px-2 py-1 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-200"
                    title="Atribuir conversa"
                  >
                    <option value="">— sem assignee —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome_exibicao ?? 'Sem nome'} ({s.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {podeApagarConversa && (
              <Button variant="danger" onClick={handleApagarConversa}>
                🗑 Apagar conversa
              </Button>
            )}
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
            <MensagemBubble
              key={m.id}
              mensagem={m}
              autor={m.autor_id ? autores.get(m.autor_id) ?? null : null}
              eMeuLado={Boolean(m.autor_id === user?.id || (isMorador && m.autor_tipo === 'morador') || (isStaff && m.autor_tipo === 'staff'))}
              mostrarMeta={Boolean(isStaff)}
            />
          ))
        )}
        {botDigitando && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-lg px-3 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-100">
              <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">🤖 Assistente</div>
              <div className="flex items-center gap-1 text-sm">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-300 animate-pulse" />
                <span className="opacity-80">digitando...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input ou status terminal */}
      {podeEnviar ? (
        <div className="mt-3 space-y-2">
          {isStaff && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={sugerirResposta}
                disabled={sugerindo}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-violet-700/20 text-violet-200 border border-violet-500/40 hover:bg-violet-700/30 disabled:opacity-50 transition"
              >
                {sugerindo ? '✨ Pensando...' : '✨ Sugerir resposta'}
              </button>
              {conversa.condominio_id && (
                <TemplatePicker
                  condominio_id={conversa.condominio_id}
                  tipo="chat"
                  onSelect={(t) => setNovaMsg(t.corpo)}
                />
              )}
              {sugestaoErr && (
                <span className="text-[11px] text-red-300">{sugestaoErr}</span>
              )}
            </div>
          )}
          <form onSubmit={handleEnviar} className="flex gap-2">
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
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500 italic text-center py-3 border-t border-slate-800">
          Conversa encerrada. {isMorador && 'Abra uma nova se precisar.'}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------

function MensagemBubble({
  mensagem: m,
  autor,
  eMeuLado,
  mostrarMeta,
}: {
  mensagem: Mensagem
  autor: AutorInfo | null
  eMeuLado: boolean
  mostrarMeta?: boolean
}) {
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

  const emoji = isBot ? '🤖' : m.autor_tipo === 'morador' ? '👤' : '🏢'
  // Fallback enquanto o autor ainda nao foi resolvido
  const nome = autor?.nome ?? (isBot ? 'Bot' : m.autor_tipo === 'morador' ? 'Morador' : 'Administração')
  const sublabel = autor?.sublabel ?? ''

  return (
    <div className={`flex ${eMeuLado ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 ${bubbleCls}`}>
        <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
          {emoji} {nome}{sublabel ? ` · ${sublabel}` : ''}
          {' · '}
          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <p className="text-sm whitespace-pre-wrap">{m.conteudo}</p>
        {isBot && mostrarMeta && m.metadata && (() => {
          const meta = m.metadata as { modelo?: string; transferir?: boolean; artigos_consultados?: unknown }
          const artigos = Array.isArray(meta.artigos_consultados) ? meta.artigos_consultados.join(', ') : null
          return (
            <div className="mt-1.5 pt-1.5 border-t border-purple-500/20 text-[10px] text-purple-300/80 flex flex-wrap gap-x-2">
              {meta.modelo && <span>{meta.modelo}</span>}
              {artigos && <span>· artigos: {artigos}</span>}
              {meta.transferir && <span>· transferiu p/ humano</span>}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
