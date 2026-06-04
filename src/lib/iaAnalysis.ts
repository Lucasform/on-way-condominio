import { supabase } from './supabase'

export interface IAAnalysis {
  cabe_multa: boolean
  artigo_aplicavel: string | null
  citacao_artigo?: string | null
  tipo_infracao: string
  valor_sugerido_reais: number | null
  minuta: string
  confianca: 'baixa' | 'media' | 'alta'
  justificativa: string
}

export interface IAResult {
  ocorrencia_id: string
  analysis: IAAnalysis
  artigos_consultados: Array<{
    id: string
    numero: string | null
    titulo: string
    conteudo?: string
    similarity: number
  }>
  modelo: string
  tokens: { input: number | null; output: number | null }
}

/**
 * Chama a Edge Function `analyze-ocorrencia` (Claude Sonnet 4.6 + RAG).
 * `comentario_extra` é uma instrução pontual pra esta análise (não persistido).
 * O `comentario_gestao` salvo na ocorrência é lido pela própria Edge Function.
 */
export async function analisarOcorrenciaIA(
  ocorrenciaId: string,
  comentario_extra?: string,
): Promise<IAResult> {
  const { data, error } = await supabase.functions.invoke('analyze-ocorrencia', {
    body: { ocorrencia_id: ocorrenciaId, comentario_extra: comentario_extra ?? null },
  })
  if (error) throw error
  if (!data || !data.analysis) {
    throw new Error('Resposta inválida da IA: ' + JSON.stringify(data).slice(0, 200))
  }
  return data as IAResult
}

/**
 * Lê a última análise persistida na ocorrência (sobrevive entre sessões).
 */
export async function getOcorrenciaIaAnalysis(ocorrenciaId: string): Promise<{
  analysis: IAAnalysis
  artigos_consultados: IAResult['artigos_consultados']
  modelo: string
  analisada_em: string
} | null> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('ia_analysis, ia_analisada_em')
    .eq('id', ocorrenciaId)
    .maybeSingle()
  if (error || !data?.ia_analysis) return null
  const raw = data.ia_analysis as {
    analysis: IAAnalysis
    artigos_consultados: IAResult['artigos_consultados']
    modelo: string
  }
  return {
    analysis: raw.analysis,
    artigos_consultados: raw.artigos_consultados ?? [],
    modelo: raw.modelo,
    analisada_em: data.ia_analisada_em as string,
  }
}

/**
 * Atualiza a análise da ocorrência (edição manual depois de gerada).
 */
export async function updateOcorrenciaIaAnalysis(
  ocorrenciaId: string,
  patch: Partial<IAAnalysis>,
): Promise<void> {
  const atual = await getOcorrenciaIaAnalysis(ocorrenciaId)
  if (!atual) throw new Error('Ainda não há análise pra editar.')
  const novaAnalysis: IAAnalysis = { ...atual.analysis, ...patch }
  const { error } = await supabase
    .from('ocorrencias')
    .update({
      ia_analysis: {
        analysis: novaAnalysis,
        artigos_consultados: atual.artigos_consultados,
        modelo: atual.modelo,
      },
    })
    .eq('id', ocorrenciaId)
  if (error) throw error
}

/**
 * Stash da sugestão IA pra ser lida pelo MultaNova (etapa 43).
 */
export interface IAStashedSuggestion {
  ocorrencia_id: string
  artigo: string
  valor: number
  descricao: string  // = minuta
  origem: 'ia'
  modelo: string
}

const STASH_KEY = 'onway:ia:suggestion'

export function stashIASuggestion(suggestion: IAStashedSuggestion): void {
  sessionStorage.setItem(STASH_KEY, JSON.stringify(suggestion))
}

export function readIASuggestion(ocorrencia_id: string): IAStashedSuggestion | null {
  const raw = sessionStorage.getItem(STASH_KEY)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as IAStashedSuggestion
    if (s.ocorrencia_id !== ocorrencia_id) return null
    return s
  } catch {
    return null
  }
}

export function clearIASuggestion(): void {
  sessionStorage.removeItem(STASH_KEY)
}

/**
 * Regenerar embedding de um artigo do regimento (admin).
 */
export async function regenerateEmbedding(artigoId: string, text: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: { artigo_id: artigoId, text },
  })
  if (error) throw error
  if (!data?.ok) throw new Error('Falha ao gerar embedding: ' + JSON.stringify(data))
}
