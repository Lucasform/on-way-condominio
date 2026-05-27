// supabase/functions/analyze-ocorrencia/index.ts
// Análise IA de ocorrência: gera embedding (Supabase.ai nativo) -> RAG nos artigos
// do regimento -> Claude API -> retorna JSON estruturado.
//
// HUMAN-IN-THE-LOOP: apenas sugere. Não cria multa nem altera ocorrência.
//
// Body: { ocorrencia_id: uuid }
// Auth: JWT válido (usuário logado com acesso à ocorrência via RLS).
// Secrets: ANTHROPIC_API_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

// @ts-expect-error: Supabase.ai injetado pelo runtime
const session = new Supabase.ai.Session('gte-small')

const CLAUDE_MODEL = 'claude-sonnet-4-6'

interface AnalysisResult {
  cabe_multa: boolean
  artigo_aplicavel: string | null
  tipo_infracao: string
  valor_sugerido_reais: number | null
  minuta: string
  confianca: 'baixa' | 'media' | 'alta'
  justificativa: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization header obrigatório.' }, 401)

    const body = await req.json()
    const ocorrencia_id = body?.ocorrencia_id
    if (!ocorrencia_id) {
      return jsonResponse({ error: 'ocorrencia_id obrigatório.' }, 400)
    }
    const comentario_extra: string | null = typeof body?.comentario_extra === 'string'
      ? body.comentario_extra.trim() || null
      : null

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return jsonResponse({
        error: 'ANTHROPIC_API_KEY não configurada nos secrets.',
      }, 500)
    }

    // Cliente com a JWT do chamador (RLS aplica)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )

    // 1) Busca ocorrência (+ unidade pra contexto da IA)
    const { data: ocorrencia, error: oErr } = await userClient
      .from('ocorrencias')
      .select(
        'id, condominio_id, descricao, local, unidade_id, comentario_gestao, unidades:unidade_id(bloco, numero)',
      )
      .eq('id', ocorrencia_id)
      .single()
    if (oErr || !ocorrencia) {
      return jsonResponse({
        error: `Ocorrência não encontrada ou sem acesso: ${oErr?.message ?? ''}`,
      }, 404)
    }

    // 1.b) Busca padrões "treinados" do condomínio:
    //   - ai_instrucoes (campo singleton em condominios)
    //   - todos os anexos ATIVOS do tipo modelo_notificacao e modelo_multa com texto extraído
    //   - fallback no campo legado modelo_notificacao_texto se nenhum anexo ativo
    const { data: condoCtx } = await userClient
      .from('condominios')
      .select('nome, modelo_notificacao_texto, ai_instrucoes')
      .eq('id', ocorrencia.condominio_id)
      .maybeSingle()
    const aiInstrucoes: string | null = (condoCtx?.ai_instrucoes ?? '').trim() || null
    const condoNome: string = condoCtx?.nome ?? 'condomínio'

    const { data: anexosModelo } = await userClient
      .from('condominio_anexos')
      .select('tipo, nome, texto_extraido')
      .eq('condominio_id', ocorrencia.condominio_id)
      .in('tipo', ['modelo_notificacao', 'modelo_multa'])
      .eq('ativo', true)
      .not('texto_extraido', 'is', null)
    const modelosAtivos = (anexosModelo ?? []) as Array<{ tipo: string; nome: string; texto_extraido: string }>
    // Junta os modelos num único bloco com cabeçalho identificando cada um
    let modelosTexto: string | null = null
    if (modelosAtivos.length > 0) {
      modelosTexto = modelosAtivos
        .map((m) => `--- ${m.nome} (${m.tipo === 'modelo_multa' ? 'modelo de multa' : 'modelo de notificação'}) ---\n${m.texto_extraido}`)
        .join('\n\n')
    } else if (condoCtx?.modelo_notificacao_texto) {
      // Fallback no campo legado
      modelosTexto = condoCtx.modelo_notificacao_texto
    }

    // 2) Gera embedding da descrição (+ contexto da gestão se houver)
    const queryText = [
      ocorrencia.local ?? '',
      ocorrencia.descricao,
      ocorrencia.comentario_gestao ?? '',
      comentario_extra ?? '',
    ].filter(Boolean).join('\n').trim()
    const embOut = await session.run(queryText, { mean_pool: true, normalize: true })
    const queryEmbedding = Array.isArray(embOut) ? embOut : Array.from(embOut as number[])

    // 3) RAG: busca top-5 artigos relevantes
    const { data: artigos, error: rErr } = await userClient.rpc('match_regimento_artigos', {
      query_embedding: queryEmbedding,
      p_condominio_id: ocorrencia.condominio_id,
      match_count: 5,
      similarity_threshold: 0.2,
    })
    if (rErr) {
      return jsonResponse({ error: `Falha no RAG: ${rErr.message}` }, 500)
    }

    const artigosList = (artigos ?? []) as Array<{
      id: string
      numero: string | null
      titulo: string
      conteudo: string
      similarity: number
    }>

    // 4) Monta prompts. Prompt caching do Claude exige bloco com >= 1024 tokens
    // (~4000 chars em PT-BR). Aplicamos cache_control só quando o bloco passa
    // desse limiar; senão Anthropic rejeita a request inteira.
    type Bloco = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
    const systemBlocos: Bloco[] = []
    const MIN_CACHE_CHARS = 4000

    function addBloco(text: string) {
      const bloco: Bloco = { type: 'text', text }
      if (text.length >= MIN_CACHE_CHARS) bloco.cache_control = { type: 'ephemeral' }
      systemBlocos.push(bloco)
    }

    // Bloco 1: instruções fixas
    addBloco(`Você é um assistente do síndico de um condomínio brasileiro chamado "${condoNome}".
Analisa ocorrências e, com base nos artigos do regimento fornecidos, sugere se cabe multa.

REGRAS:
- Você APENAS sugere. Quem decide é o síndico.
- NÃO invente artigos fora da lista.
- Se nenhum artigo se aplica, "cabe_multa" = false.
- "confianca" = "alta" só quando a relação ocorrência-artigo é direta.
- "valor_sugerido_reais" proporcional à gravidade (R$ 50 a R$ 2000 tipicamente).
- "minuta": texto formal pra enviar ao morador, sucinto e respeitoso.

Responda EXCLUSIVAMENTE em JSON válido, sem markdown.`)

    // Bloco 2: regimento
    if (artigosList.length > 0) {
      const regimentoTexto = artigosList
        .map((a) => `[${a.numero ?? 's/n'}] ${a.titulo}\n${a.conteudo}`)
        .join('\n\n')
      addBloco(`ARTIGOS DO REGIMENTO INTERNO RELEVANTES PARA O CASO:\n${regimentoTexto}`)
    }

    // Bloco 3: padrão de escrita do condomínio
    if (modelosTexto) {
      addBloco(`MODELOS DE NOTIFICAÇÃO/MULTA DESTE CONDOMÍNIO (use como guia de estilo, tom e formato da minuta; não copie literalmente):\n${modelosTexto}`)
    }

    // Bloco 4: instruções customizadas do síndico
    if (aiInstrucoes) {
      addBloco(`INSTRUÇÕES ESPECÍFICAS DESTE CONDOMÍNIO:\n${aiInstrucoes}`)
    }

    const unidadeRel = (ocorrencia as { unidades?: { bloco: string | null; numero: string } | null }).unidades
    const unidadeStr = unidadeRel
      ? (unidadeRel.bloco ? `${unidadeRel.bloco}-${unidadeRel.numero}` : unidadeRel.numero)
      : 'Área comum / não vinculada'

    // Bloco "fresh": dados da ocorrência específica (NÃO cacheado, muda sempre)
    const userPrompt = `OCORRÊNCIA
Unidade: ${unidadeStr}
Local: ${ocorrencia.local ?? '(não especificado)'}
Descrição: ${ocorrencia.descricao}
${ocorrencia.comentario_gestao ? `\nCOMENTÁRIO DA GESTÃO (contexto persistente):\n${ocorrencia.comentario_gestao}\n` : ''}${comentario_extra ? `\nINSTRUÇÃO ADICIONAL DESTA ANÁLISE:\n${comentario_extra}\n` : ''}
${artigosList.length === 0 ? '(condomínio sem regimento cadastrado, ou nada bate semanticamente)' : ''}

Responda em JSON com EXATAMENTE este schema:
{
  "cabe_multa": boolean,
  "artigo_aplicavel": string | null,
  "tipo_infracao": string,
  "valor_sugerido_reais": number | null,
  "minuta": string,
  "confianca": "baixa" | "media" | "alta",
  "justificativa": string
}`

    // 5) Claude API com prompt caching ativado
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemBlocos,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return jsonResponse({
        error: `Claude API ${anthropicRes.status}: ${errText.slice(0, 500)}`,
      }, 500)
    }

    const anthropicData = await anthropicRes.json()
    const rawText: string = anthropicData?.content?.[0]?.text ?? ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return jsonResponse(
        {
          error: 'Resposta da Claude sem JSON válido.',
          raw: rawText.slice(0, 500),
        },
        502,
      )
    }
    let analysis: AnalysisResult
    try {
      analysis = JSON.parse(jsonMatch[0]) as AnalysisResult
    } catch (e) {
      return jsonResponse(
        {
          error: `JSON inválido: ${e instanceof Error ? e.message : String(e)}`,
          raw: rawText.slice(0, 500),
        },
        502,
      )
    }

    return jsonResponse({
      ocorrencia_id,
      analysis,
      artigos_consultados: artigosList.map((a) => ({
        id: a.id,
        numero: a.numero,
        titulo: a.titulo,
        similarity: Number(a.similarity.toFixed(3)),
      })),
      modelo: CLAUDE_MODEL,
      usou_modelo_redacao: !!modeloNotif,
      usou_instrucoes_custom: !!aiInstrucoes,
      tokens: {
        input: anthropicData?.usage?.input_tokens ?? null,
        output: anthropicData?.usage?.output_tokens ?? null,
        cache_read: anthropicData?.usage?.cache_read_input_tokens ?? null,
        cache_write: anthropicData?.usage?.cache_creation_input_tokens ?? null,
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
