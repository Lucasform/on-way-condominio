import { useRef, useState, type DragEvent, type ChangeEvent, type KeyboardEvent } from 'react'
import { extractPdfWithAI, type PdfAiContext, type PdfExtractResult } from '../lib/pdfAi'
import { sendChatMessage, type ChatMessage } from '../lib/aiChat'

interface Props {
  context: PdfAiContext
  onExtracted: (result: PdfExtractResult) => void
  disabled?: boolean
  placeholder?: string
}

const CONTEXT_LABELS: Record<PdfAiContext, string> = {
  unidades: 'unidades',
  pessoas: 'pessoas',
  ocorrencia: 'ocorrência',
  comunicado: 'comunicado',
}

const PLACEHOLDERS: Record<PdfAiContext, string> = {
  unidades: 'Ex.: "Este PDF contém as unidades do bloco A. Torre B ainda não está aqui."',
  pessoas: 'Ex.: "São moradores do bloco A. Desconsidere funcionários listados no final."',
  ocorrencia: 'Ex.: "Boletim de ocorrência de barulho excessivo no apartamento 302."',
  comunicado: 'Ex.: "Gere um comunicado formal informando a manutenção do elevador."',
}

function buildReviewSystemPrompt(result: PdfExtractResult): string {
  const label = CONTEXT_LABELS[result.context]
  const tokens = result.tokens
  const isNearLimit = (tokens.output ?? 0) > 14000
  const extracted = result.extracted

  let count = 0
  let sample = ''
  if ('unidades' in extracted && Array.isArray(extracted.unidades)) {
    count = extracted.unidades.length
    sample = JSON.stringify(extracted.unidades.slice(0, 5), null, 2)
  } else if ('pessoas' in extracted && Array.isArray(extracted.pessoas)) {
    count = extracted.pessoas.length
    sample = JSON.stringify(extracted.pessoas.slice(0, 5), null, 2)
  } else {
    sample = JSON.stringify(extracted, null, 2).slice(0, 600)
  }

  return [
    'Você é um assistente de revisão de importação de dados do OnWay Condomínio.',
    'O usuário acabou de extrair dados de um PDF. Ajude-o a entender o resultado.',
    '',
    'Contexto da extração:',
    `- Tipo: ${label}`,
    `- Total de registros extraídos: ${count}`,
    `- Tokens de saída usados: ${tokens.output ?? '?'} de 16.000 disponíveis`,
    isNearLimit
      ? '- ATENÇÃO: o limite de processamento foi atingido — o PDF provavelmente tem mais registros. Sugira dividir em partes menores.'
      : '- O processamento foi concluído sem truncamento.',
    '',
    'Amostra dos dados extraídos:',
    sample,
    '',
    'Responda dúvidas sobre os dados. Se perguntarem por que poucos registros foram extraídos, explique o limite e sugira dividir o PDF. Seja conciso. Responda em português.',
  ].join('\n')
}

function buildFirstMessage(result: PdfExtractResult): string {
  const label = CONTEXT_LABELS[result.context]
  const tokens = result.tokens
  const isNearLimit = (tokens.output ?? 0) > 14000
  const extracted = result.extracted

  let count = 0
  if ('unidades' in extracted && Array.isArray(extracted.unidades)) count = extracted.unidades.length
  else if ('pessoas' in extracted && Array.isArray(extracted.pessoas)) count = extracted.pessoas.length

  const parts = [`Extraí **${count} ${label}** do documento.`]

  if (isNearLimit) {
    parts.push(
      `Atenção: o limite de processamento foi atingido (${tokens.output} tokens). O PDF tem mais registros que não foram capturados. Para importar tudo, divida o PDF em partes menores (ex: 5 páginas por vez) e repita a importação em etapas.`,
    )
  } else if (count === 0) {
    parts.push('Não encontrei registros. Verifique se o PDF tem texto selecionável (não é imagem digitalizada).')
  } else {
    parts.push('Os dados estão prontos para revisão.')
  }

  parts.push('Tem alguma dúvida antes de confirmar?')
  return parts.join(' ')
}

type Phase = 'idle' | 'loading' | 'review' | 'error'

export default function PdfAiImport({ context, onExtracted, disabled, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [instrucoes, setInstrucoes] = useState('')
  const [extractResult, setExtractResult] = useState<PdfExtractResult | null>(null)
  const [streamChars, setStreamChars] = useState(0)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')

  async function process(file: File) {
    setErrorMsg(null)
    setStreamChars(0)
    setPhase('loading')
    try {
      const result = await extractPdfWithAI(file, context, instrucoes, (chars) => setStreamChars(chars))
      setExtractResult(result)
      setSystemPrompt(buildReviewSystemPrompt(result))
      setChatMessages([{ role: 'assistant', content: buildFirstMessage(result) }])
      setChatInput('')
      setChatError(null)
      setPhase('review')
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro ao processar PDF.')
      setPhase('error')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) void process(file)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  async function sendMessage() {
    const text = chatInput.trim()
    if (!text || chatLoading || !extractResult) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages: ChatMessage[] = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatError(null)
    setChatLoading(true)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const { reply } = await sendChatMessage(newMessages, systemPrompt)
      setChatMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Erro ao responder.')
    } finally {
      setChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  function confirmExtract() {
    if (extractResult) {
      onExtracted(extractResult)
      setPhase('idle')
      setExtractResult(null)
      setChatMessages([])
    }
  }

  function resetToIdle() {
    setPhase('idle')
    setExtractResult(null)
    setChatMessages([])
    setErrorMsg(null)
  }

  // ---- FASE REVIEW ----
  if (phase === 'review' && extractResult) {
    const tokens = extractResult.tokens
    const isNearLimit = (tokens.output ?? 0) > 14000

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Revisão com IA
          </span>
          {tokens.output != null && (
            <span className={isNearLimit ? 'text-amber-400 font-medium' : 'text-slate-600'}>
              {tokens.output.toLocaleString()} / 16.000 tokens
              {isNearLimit && ' ⚠️'}
            </span>
          )}
        </div>

        {/* Chat thread */}
        <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900/40">
          <div className="max-h-56 overflow-y-auto p-3 space-y-2.5">
            {chatMessages.map((msg, i) => (
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
            ))}
            {chatLoading && (
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
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-700 flex items-end gap-2 p-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={chatLoading}
              rows={1}
              placeholder="Pergunte algo sobre os dados... (Enter envia)"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none py-1 px-1 disabled:opacity-50 min-h-[28px]"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={chatLoading || !chatInput.trim()}
              className="shrink-0 p-1.5 rounded-md text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 disabled:opacity-30 transition"
              title="Enviar (Enter)"
            >
              <SendIcon />
            </button>
          </div>
        </div>

        {chatError && (
          <p className="text-xs text-red-400 px-1">{chatError}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirmExtract}
            className="flex-1 px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition"
          >
            Confirmar extração
          </button>
          <button
            type="button"
            onClick={resetToIdle}
            className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 text-sm transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ---- IDLE / LOADING / ERROR ----
  return (
    <div className="space-y-3">
      {phase !== 'loading' && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Orientação para a IA <span className="text-slate-600">(opcional)</span>
          </label>
          <textarea
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder={placeholder ?? PLACEHOLDERS[context]}
            className="w-full rounded-md bg-slate-800/60 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
        </div>
      )}

      <div
        className={[
          'relative border-2 border-dashed rounded-xl p-6 text-center transition-colors',
          dragging ? 'border-amber-400 bg-amber-400/5' : 'border-slate-700 hover:border-slate-500',
          disabled || phase === 'loading' ? 'pointer-events-none opacity-50' : 'cursor-pointer',
        ].join(' ')}
        onClick={() => phase === 'idle' && !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />
        {phase === 'loading' ? (
          <div className="flex flex-col items-center gap-3">
            <span className="inline-block w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">
              {streamChars > 0
                ? `Extraindo dados... ${streamChars.toLocaleString('pt-BR')} caracteres`
                : 'Agente lendo o documento...'}
            </span>
            {streamChars > 0 && (
              <div className="w-32 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400/60 animate-pulse" style={{ width: '100%' }} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-sm font-medium text-slate-300">
              {phase === 'error' ? 'Tentar com outro PDF' : 'Arraste um PDF ou clique para selecionar'}
            </span>
            <span className="text-xs text-slate-500">PDF até 3 MB · A IA extrai os dados automaticamente</span>
          </div>
        )}
      </div>

      {phase === 'error' && errorMsg && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {errorMsg}
        </div>
      )}
    </div>
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
