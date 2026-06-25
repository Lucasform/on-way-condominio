import { useRef, useState, type KeyboardEvent } from 'react'
import { sendChatMessage, type ChatMessage } from '../lib/aiChat'

const SYSTEM_PROMPT = `Você é o assistente do OnWay Condomínio, um sistema de gestão condominial.

Pode ajudar com:
- Importação de moradores, unidades, ocorrências e comunicados via PDF ou planilha
- Registro e gestão de ocorrências e multas
- Comunicados para moradores
- Votações, encomendas, calendário e mural de avisos
- Dúvidas sobre o uso do sistema em geral

Seja objetivo e responda em português brasileiro. Não invente funcionalidades que não existem.`

const SUGESTOES = [
  'Como importar moradores via PDF?',
  'Por que a IA importou menos registros que o esperado?',
  'Como registrar uma ocorrência?',
  'Como criar um comunicado para todos os moradores?',
]

export default function AppAiChat() {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setOpen((v) => !v)
    if (!open) setTimeout(() => inputRef.current?.focus(), 150)
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const { reply } = await sendChatMessage(next, SYSTEM_PROMPT)
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao responder.')
    } finally {
      setLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function clearChat() {
    setMessages([])
    setError(null)
    setInput('')
  }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* Painel de chat */}
      {open && (
        <div className="fixed right-4 bottom-36 md:bottom-20 z-50 w-80 md:w-96 rounded-2xl shadow-2xl shadow-black/50 border border-slate-700 bg-slate-900 flex flex-col overflow-hidden" style={{ maxHeight: 'min(520px, calc(100dvh - 180px))' }}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
            <AiSparkIcon className="text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-100">Assistente OnWay</div>
              <div className="text-[10px] text-slate-500">Haiku · respostas rápidas</div>
            </div>
            {hasMessages && (
              <button
                type="button"
                onClick={clearChat}
                title="Limpar conversa"
                className="text-xs text-slate-600 hover:text-slate-400 transition px-1"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              className="text-slate-500 hover:text-slate-300 transition"
              title="Fechar"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Mensagens ou sugestões */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
            {!hasMessages ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 text-center pt-2">
                  Pergunte qualquer coisa sobre o sistema
                </p>
                <div className="space-y-1.5">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition border border-slate-700/50 hover:border-slate-600"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={[
                      'max-w-[88%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-brand-600/80 text-white rounded-br-sm'
                        : 'bg-slate-800 text-slate-200 rounded-bl-sm',
                    ].join(' ')}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-xl rounded-bl-sm px-3 py-2.5">
                  <span className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-400 px-1">{error}</p>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-800 flex items-end gap-2 px-3 py-2 bg-slate-900/60">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              placeholder="Mensagem... (Enter envia)"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none py-1 disabled:opacity-50 min-h-[28px] max-h-24"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="shrink-0 p-1.5 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-30 transition mb-0.5"
              title="Enviar (Enter)"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}

      {/* Botão flutuante — acima do FeedbackWidget */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Assistente de IA"
        title="Assistente de IA"
        className={[
          'fixed right-4 bottom-36 md:bottom-20 z-40 h-12 w-12 rounded-full shadow-lg shadow-black/30',
          'flex items-center justify-center transition-all outline-none',
          'focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          open
            ? 'bg-slate-700 text-slate-300'
            : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900',
        ].join(' ')}
        style={{ display: open ? 'none' : undefined }}
      >
        <AiSparkIcon />
      </button>
    </>
  )
}

function AiSparkIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
