// supabase/functions/analyze-ocorrencia/index.ts
// Recebe { ocorrencia_id } e retorna análise estruturada da IA:
//   1. Gera embedding da descrição (gte-small local)
//   2. Busca artigos relevantes do regimento via match_regimento_artigos (RAG)
//   3. Manda pro Claude (Sonnet 4.6) com o contexto
//   4. Retorna JSON estruturado: cabe_multa, artigo, valor_sugerido, minuta, confiança
//
// HUMAN-IN-THE-LOOP: esta function NÃO cria multa nem altera ocorrência.
// Ela apenas SUGERE. A tela de revisão humana (etapa 42) decide o que fazer.
//
// Secrets necessárias na Supabase:
//   - ANTHROPIC_API_KEY  (chave Anthropic do projeto)
//
// Deploy:  supabase functions deploy analyze-ocorrencia

import { createClient } from 'jsr:@supabase/supabase-js@2'
// @ts-expect-error: Deno-only import via esm.sh
import { pipeline } from 'https://esm.sh/@huggingface/transformers@3.0.2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

// Carrega o embedder na inicialização (cold start ~3-5s)
// @ts-expect-error: top-level await ok no Deno
const embedder = await pipeline('feature-extraction', 'Supabase/gte-small')

// Modelo de análise: Sonnet 4.6 (CLAUDE.md: "Sonnet para análise de multa e redação").
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization header obrigatório.' }, 401)
    }

    const body = await req.json()
    const ocorrencia_id = body?.ocorrencia_id
    if (!ocorrencia_id) {
      return jsonResponse({ error: 'ocorrencia_id obrigatório.' }, 400)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return jsonResponse({
        error: 'ANTHROPIC_API_KEY não configurada nos secrets da function.',
      }, 500)
    }

    // Cliente com a JWT do usuário (RLS valida acesso à ocorrência e ao regimento)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // 1) Busca a ocorrência (RLS bloqueia se o usuário não tem acesso)
    const { data: ocorrencia, error: oErr } = await userClient
      .from('ocorrencias')
      .select('id, condominio_id, descricao, local, unidade_id')
      .eq('id', ocorrencia_id)
      .single()
    if (oErr || !ocorrencia) {
      return jsonResponse({ error: `Ocorrência não encontrada ou sem acesso: ${oErr?.message ?? ''}` }, 404)
    }

    // 2) Gera embedding da descrição (concat com local pra melhorar contexto)
    const queryText = `${ocorrencia.local ?? ''}\n${ocorrencia.descricao}`.trim()
    const embOut = await embedder(queryText, { pooling: 'mean', normalize: true })
    const queryEmbedding = Array.from(embOut.data) as number[]

    // 3) RAG: busca top-5 artigos relevantes
    const { data: artigos, error: rErr } = await userClient.rpc('match_regimento_artigos', {
      query_embedding: queryEmbedding,
      p_condominio_id: ocorrencia.condominio_id,
      match_count: 5,
      similarity_threshold: 0.2, // baixo pra não filtrar demais; Claude vai decidir relevância
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

    // 4) Monta o prompt
    const systemPrompt = `Você é um assistente do síndico de um condomínio brasileiro.
Sua função é analisar ocorrências relatadas e, com base nos artigos do regimento interno fornecidos, sugerir se cabe multa.

REGRAS INVIOLÁVEIS:
- Você APENAS sugere. Quem decide é o síndico (humano).
- NÃO invente artigos que não estejam na lista fornecida.
- Se nenhum artigo se aplica, "cabe_multa" deve ser false.
- "confianca" = "alta" só se a relação ocorrência↔artigo é direta e inequívoca.
- "valor_sugerido_reais" deve ser proporcional à gravidade (de R$ 50 a R$ 2000 tipicamente).
- "minuta" é o texto que será enviado ao morador — escreva em português formal, sucinto e respeitoso.

Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem texto antes ou depois.`

    const userPrompt = `OCORRÊNCIA REGISTRADA
Local: ${ocorrencia.local ?? '(área comum, não especificado)'}
Descrição: ${ocorrencia.descricao}

ARTIGOS DO REGIMENTO RELEVANTES${artigosList.length === 0 ? ' (nenhum encontrado por similaridade)' : ''}:
${
      artigosList.length === 0
        ? '(o regimento deste condomínio não tem artigos cadastrados ou nenhum bate com a ocorrência)'
        : artigosList
          .map(
            (a, i) =>
              `${i + 1}. [${a.numero ?? 's/n'}] ${a.titulo}  (similaridade: ${a.similarity.toFixed(2)})\n${a.conteudo}`,
          )
          .join('\n\n')
    }

Responda em JSON com este schema EXATO:
{
  "cabe_multa": boolean,
  "artigo_aplicavel": string | null,
  "tipo_infracao": string,
  "valor_sugerido_reais": number | null,
  "minuta": string,
  "confianca": "baixa" | "media" | "alta",
  "justificativa": string
}`

    // 5) Chama a Claude API (raw fetch — sem SDK pra economizar bundle)
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
        system: systemPrompt,
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

    // 6) Parse JSON da resposta (tolerante a markdown ```json envolvendo)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return jsonResponse({
        error: 'Resposta da Claude não contém JSON válido.',
        raw: rawText.slice(0, 500),
      }, 502)
    }
    let analysis: AnalysisResult
    try {
      analysis = JSON.parse(jsonMatch[0]) as AnalysisResult
    } catch (e) {
      return jsonResponse({
        error: `JSON inválido da Claude: ${e instanceof Error ? e.message : String(e)}`,
        raw: rawText.slice(0, 500),
      }, 502)
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
      tokens: {
        input: anthropicData?.usage?.input_tokens ?? null,
        output: anthropicData?.usage?.output_tokens ?? null,
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
