import { supabase } from './supabase'

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

const MAX_PDF_BYTES = 5 * 1024 * 1024

export async function extractPdfWithAI(
  file: File,
  context: PdfAiContext,
): Promise<PdfExtractResult> {
  if (file.type !== 'application/pdf') throw new Error('Selecione um arquivo PDF.')
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`PDF muito grande. Máximo ${MAX_PDF_BYTES / 1024 / 1024} MB.`)
  }

  // Lê o arquivo como base64
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  const pdf_base64 = btoa(binary)

  const { data, error } = await supabase.functions.invoke('pdf-ai-extract', {
    body: { context, pdf_base64, filename: file.name },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)

  return data as PdfExtractResult
}
