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

const MAX_PDF_BYTES = 3 * 1024 * 1024 // 3 MB (base64 → ~4 MB payload, seguro para edge functions)

export async function extractPdfWithAI(
  file: File,
  context: PdfAiContext,
  instrucoes?: string,
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

  // Pega o token do usuário logado; cai no anon key se não estiver logado
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? SUPABASE_ANON_KEY

  // Usa fetch direto para ter acesso ao corpo de erro real (supabase.functions.invoke engole o body)
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

  let data: Record<string, unknown>
  try {
    data = await res.json()
  } catch {
    throw new Error(`Erro ${res.status} na função de IA.`)
  }

  if (!res.ok) {
    throw new Error((data?.error as string) ?? `Erro ${res.status} na função de IA.`)
  }

  return data as unknown as PdfExtractResult
}
