import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'

export type PdfAiContext = 'unidades' | 'pessoas' | 'ocorrencia' | 'comunicado'

export interface PdfUnidade {
  bloco: string | null
  numero: string
  tipo: string
  area_m2: number | null
}

export interface PdfPessoa {
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  tipo_vinculo: string
  bloco: string | null
  unidade_numero: string | null
}

export interface PdfOcorrencia {
  descricao: string
  local: string | null
  unidade_numero: string | null
  bloco: string | null
}

export interface PdfComunicado {
  titulo: string
  corpo: string
}

export type PdfExtracted =
  | { unidades: PdfUnidade[] }
  | { pessoas: PdfPessoa[] }
  | PdfOcorrencia
  | PdfComunicado

export interface PdfExtractResult {
  context: PdfAiContext
  extracted: PdfExtracted
  modelo: string
  tokens: { input: number | null; output: number | null }
}

const MAX_PDF_BYTES = 3 * 1024 * 1024

export async function extractPdfWithAI(
  file: File,
  context: PdfAiContext,
  instrucoes?: string,
  onProgress?: (charsReceived: number) => void,
): Promise<PdfExtractResult> {
  if (file.type !== 'application/pdf') throw new Error('Selecione um arquivo PDF.')
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`PDF muito grande. Máximo ${MAX_PDF_BYTES / 1024 / 1024} MB.`)
  }

  // Converte para base64 em chunks para não travar o thread
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  const pdf_base64 = btoa(binary)

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  const res = await fetch(`${SUPABASE_URL}/functions/v1/pdf-ai-extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      context,
      pdf_base64,
      filename: file.name,
      instrucoes: instrucoes?.trim() || undefined,
    }),
  })

  // Non-streaming error response (auth, rate limit, validation errors)
  if (!res.ok) {
    let errMsg = `Erro ${res.status} na função de IA.`
    try {
      const data = await res.json() as Record<string, unknown>
      if (data?.error) errMsg = data.error as string
    } catch {}
    throw new Error(errMsg)
  }

  // Check if response is streaming SSE
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    // Fallback: non-streaming JSON (shouldn't happen in normal flow)
    const data = await res.json() as Record<string, unknown>
    if (data?.error) throw new Error(data.error as string)
    return data as unknown as PdfExtractResult
  }

  // Consume SSE stream
  if (!res.body) throw new Error('Resposta da IA sem corpo.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ''
  let totalChars = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    lineBuffer += decoder.decode(value, { stream: true })
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw) continue

      let event: Record<string, unknown>
      try { event = JSON.parse(raw) } catch { continue }

      if (event.type === 'text' && typeof event.text === 'string') {
        totalChars += event.text.length
        onProgress?.(totalChars)
      }

      if (event.type === 'done') {
        return event as unknown as PdfExtractResult
      }

      if (event.type === 'error') {
        throw new Error((event.error as string) ?? 'Erro durante extração.')
      }
    }
  }

  throw new Error('Processamento interrompido antes de completar. Tente novamente.')
}
