// supabase/functions/parse-condominio-pdf/index.ts
// Processa PDFs anexados ao condomínio:
//   tipo='regimento'  -> extrai texto, divide em artigos via regex,
//                        cria registros em regimento_artigos com embeddings
//   tipo='modelo'     -> extrai texto, trunca em ~3000 chars, salva em
//                        condominios.modelo_notificacao_texto pra servir
//                        de guideline de estilo no analyze-ocorrencia
//
// Body: { anexo_id: uuid }  (preferido — usa tabela condominio_anexos)
//   ou:  { condominio_id: uuid, tipo: 'regimento' | 'modelo' }  (legado, ainda aceito)
// Auth: JWT de staff do condomínio (RLS valida).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2'
// unpdf: lib feita pra ambientes serverless/edge (sem dependência de Worker).
// extractText devolve { totalPages, text: string[] } com texto por página.
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'
import { Logger } from '../_shared/log.ts'

// @ts-expect-error: Supabase.ai injetado pelo runtime
const aiSession = new Supabase.ai.Session('gte-small')

const MAX_MODELO_CHARS = 3000
const MAX_ARTIGO_CHARS = 2000

Deno.serve(async (req: Request) => {
  const log = new Logger('parse-condominio-pdf')
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization header obrigatório.' }, 401)

    const body = await req.json()
    const anexo_id: string | undefined = body?.anexo_id
    const legadoCondominioId: string | undefined = body?.condominio_id
    const legadoTipo: 'regimento' | 'modelo' | undefined = body?.tipo

    if (!anexo_id && (!legadoCondominioId || !legadoTipo)) {
      return jsonResponse({ error: 'anexo_id (uuid) obrigatório.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let url: string | null = null
    let condominio_id: string
    let tipoFinal: 'regimento' | 'modelo'
    let anexoRow: { id: string; nome: string } | null = null

    if (anexo_id) {
      const { data: anexo, error: aErr } = await admin
        .from('condominio_anexos')
        .select('id, condominio_id, tipo, url, nome')
        .eq('id', anexo_id)
        .maybeSingle()
      if (aErr || !anexo) return jsonResponse({ error: 'Anexo não encontrado.' }, 404)
      url = anexo.url
      condominio_id = anexo.condominio_id
      tipoFinal = anexo.tipo === 'regimento' ? 'regimento' : 'modelo'
      anexoRow = { id: anexo.id, nome: anexo.nome }
    } else {
      // Caminho legado (campos antigos em condominios)
      condominio_id = legadoCondominioId!
      tipoFinal = legadoTipo!
      const { data: condo, error: cErr } = await admin
        .from('condominios')
        .select('id, regimento_pdf_url, modelo_notificacao_url')
        .eq('id', condominio_id)
        .maybeSingle()
      if (cErr || !condo) return jsonResponse({ error: 'Condomínio não encontrado.' }, 404)
      url = tipoFinal === 'regimento' ? condo.regimento_pdf_url : condo.modelo_notificacao_url
      if (!url) return jsonResponse({ error: `Nenhum PDF de ${tipoFinal} anexado.` }, 400)
    }

    const tipo: 'regimento' | 'modelo' = tipoFinal

    // Baixa e extrai texto do PDF
    const texto = await extrairTextoDoPdf(url)
    if (!texto || texto.trim().length < 20) {
      return jsonResponse({ error: 'Não foi possível extrair texto útil do PDF.' }, 422)
    }

    if (tipo === 'modelo') {
      const truncado = texto.trim().slice(0, MAX_MODELO_CHARS)
      // Se veio por anexo_id, grava na linha do anexo (nova arquitetura)
      if (anexoRow) {
        await admin
          .from('condominio_anexos')
          .update({ texto_extraido: truncado, processado_em: new Date().toISOString() })
          .eq('id', anexoRow.id)
      } else {
        // Caminho legado
        await admin
          .from('condominios')
          .update({ modelo_notificacao_texto: truncado })
          .eq('id', condominio_id)
      }
      return jsonResponse({ ok: true, tipo, chars_salvos: truncado.length })
    }

    // tipo === 'regimento' — divide em artigos
    // 1) tenta regex (rápido, gratuito)
    let artigos = dividirEmArtigos(texto)
    let usouIA = false

    // 2) fallback: IA divide quando regex falha mas tem texto util
    if (artigos.length < 3 && texto.trim().length > 400) {
      log.info('regex_low_yield_trying_ia', { artigos_regex: artigos.length })
      const artigosIA = await dividirComIA(texto)
      if (artigosIA.length > artigos.length) {
        artigos = artigosIA
        usouIA = true
      }
    }

    if (artigos.length === 0) {
      // diagnóstico melhor pra distinguir PDF escaneado de formato exótico
      const motivo = texto.trim().length < 100
        ? 'O PDF parece estar escaneado (sem texto extraível). Rode num OCR antes de subir (Adobe Acrobat, ilovepdf.com).'
        : 'Não conseguimos dividir o conteúdo em artigos. Cadastre manualmente em /regimento ou tente um PDF com estrutura "Art. 1", "Art. 2" etc.'
      return jsonResponse({ error: motivo, chars_extraidos: texto.length }, 422)
    }

    // Gera titulos contextuais com Claude Haiku (uma unica chamada em batch).
    // Se falhar ou a key nao estiver setada, cai no comportamento antigo (primeira linha).
    const titulosContextuais = await gerarTitulosContextuais(artigos)

    // Insere artigos. Convenção: 'numero' = "Art. X", 'titulo' = título contextual gerado pela IA, 'conteudo' = bloco completo
    let criados = 0
    for (let i = 0; i < artigos.length; i++) {
      const a = artigos[i]
      // Verifica se já existe esse "Art. X" pra evitar duplicar a cada reprocessamento
      const { data: existente } = await admin
        .from('regimento_artigos')
        .select('id')
        .eq('condominio_id', condominio_id)
        .eq('numero', a.numero)
        .maybeSingle()
      if (existente) continue

      const conteudo = a.conteudo.slice(0, MAX_ARTIGO_CHARS)
      const titulo = (titulosContextuais[i] || a.titulo).slice(0, 200) || a.numero

      const { data: criado, error: insErr } = await admin
        .from('regimento_artigos')
        .insert({
          condominio_id,
          numero: a.numero,
          titulo,
          conteudo,
          ordem: criados,
          ativo: true,
        })
        .select('id')
        .single()
      if (insErr || !criado) continue
      criados++

      // Gera embedding (titulo + conteudo)
      try {
        const textoPraEmbed = `${titulo}\n\n${conteudo}`
        const output = await aiSession.run(textoPraEmbed, { mean_pool: true, normalize: true })
        const embedding = Array.isArray(output) ? output : Array.from(output as number[])
        await admin
          .from('regimento_artigos')
          .update({ embedding, embedding_atualizado_em: new Date().toISOString() })
          .eq('id', criado.id)
      } catch (_e) {
        // Embedding pode falhar, artigo fica salvo sem ele — pode regerar depois
      }
    }

    // Atualiza estat no anexo se veio por anexo_id
    if (anexoRow) {
      await admin
        .from('condominio_anexos')
        .update({ artigos_extraidos: criados, processado_em: new Date().toISOString() })
        .eq('id', anexoRow.id)
    }

    return jsonResponse({
      ok: true,
      tipo,
      artigos_encontrados: artigos.length,
      artigos_criados: criados,
      artigos_duplicados: artigos.length - criados,
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

// ============================================================
// Helpers
// ============================================================

async function extrairTextoDoPdf(url: string): Promise<string> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Falha ao baixar PDF: ${resp.status}`)
  const buf = await resp.arrayBuffer()
  const data = new Uint8Array(buf)

  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: false })
  const paginas = Array.isArray(text) ? text : [text]
  // Junta páginas com quebra dupla; normaliza whitespace excessivo.
  return paginas
    .join('\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface ArtigoBruto {
  numero: string
  titulo: string
  conteudo: string
}

function dividirEmArtigos(texto: string): ArtigoBruto[] {
  // Regex captura "Art. 1", "Art 1°", "Art. 1º", "Artigo 1", "ART. 1", etc.
  const regex = /(art(?:igo)?\.?\s*\d+[ºo°]?)/gi
  const matches: Array<{ idx: number; numero: string }> = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(texto)) !== null) {
    matches.push({ idx: m.index, numero: normalizarNumero(m[1]) })
  }
  if (matches.length === 0) return []

  const out: ArtigoBruto[] = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx
    const end = i + 1 < matches.length ? matches[i + 1].idx : texto.length
    const bloco = texto.slice(start, end).trim()
    // Remove o prefixo "Art. X" do início pra separar titulo/conteudo
    const semPrefixo = bloco.replace(/^art(?:igo)?\.?\s*\d+[ºo°]?\s*[-.:—]?\s*/i, '').trim()
    const linhas = semPrefixo.split(/\n+/)
    const titulo = (linhas[0] ?? '').trim()
    const conteudo = (linhas.slice(1).join('\n').trim() || titulo)
    out.push({ numero: matches[i].numero, titulo, conteudo })
  }
  return out
}

function normalizarNumero(raw: string): string {
  const m = raw.match(/\d+/)
  if (!m) return raw
  return `Art. ${m[0]}`
}

// Pede pra Claude Haiku gerar um titulo curto e contextual pra cada artigo.
// Uma unica chamada em batch (~50 artigos cabem com folga em 4k tokens output).
// Fallback: retorna os titulos extraidos por heuristica (primeira linha).
async function gerarTitulosContextuais(artigos: ArtigoBruto[]): Promise<string[]> {
  const fallback = artigos.map((a) => a.titulo)
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return fallback
  if (artigos.length === 0) return []

  // Snippet curto de cada artigo pra economizar token (titulo bruto + comeco do conteudo)
  const items = artigos.map((a, i) => {
    const corpo = `${a.titulo}\n${a.conteudo}`.replace(/\s+/g, ' ').trim().slice(0, 350)
    return `${i + 1}. ${a.numero}: ${corpo}`
  }).join('\n\n')

  const system = `Voce recebe artigos de regimento interno de condominio e gera um TITULO curto e contextual pra cada um. Regras:
- 3 a 8 palavras
- descreve o ASSUNTO do artigo, nao parafraseia a primeira frase
- comeca com substantivo, sem ponto final
- evita generico como "Disposicoes gerais" se houver tema especifico
- sem aspas, sem numeracao, sem prefixo "Art."

Responda EXCLUSIVAMENTE em JSON, sem markdown, no formato:
{"titulos": ["titulo do artigo 1", "titulo do artigo 2", ...]}
O array DEVE ter exatamente ${artigos.length} elementos na mesma ordem da entrada.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: Math.min(4096, 60 * artigos.length + 200),
        system,
        messages: [{ role: 'user', content: items }],
      }),
    })
    if (!res.ok) {
      console.warn('[parse-condominio-pdf] titulos Haiku status', res.status)
      return fallback
    }
    const data = await res.json()
    const raw: string = data?.content?.[0]?.text ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback
    const parsed = JSON.parse(jsonMatch[0]) as { titulos?: string[] }
    if (!Array.isArray(parsed.titulos)) return fallback
    return artigos.map((_, i) => {
      const t = (parsed.titulos?.[i] ?? '').trim()
      return t || fallback[i]
    })
  } catch (e) {
    console.warn('[parse-condominio-pdf] falha titulos Haiku:', (e as Error).message)
    return fallback
  }
}

/**
 * Fallback: pede pra Haiku dividir o texto em "artigos lógicos" quando o
 * regex de "Art. X" falha. Cobre regimentos em formato de lista numerada
 * ("1. Cadastro", "2. Responsabilidade") e seções em CAIXA ALTA. Custo
 * baixo (Haiku, 1 chamada). Retorna [] em caso de erro/sem chave.
 */
async function dividirComIA(texto: string): Promise<ArtigoBruto[]> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) {
    console.log('[parse] sem ANTHROPIC_API_KEY, IA fallback desabilitado')
    return []
  }
  const truncado = texto.slice(0, 60_000) // ~15k tokens
  const system = `Voce e um parser de documentos legais condominiais (regimento interno, regulamento, convencao, regras de uso).
Sua tarefa: dividir o texto em "artigos logicos" — uma lista numerada de regras, cada uma com numero, titulo curto e conteudo.

Como decidir o que e um artigo:
- Se o texto tem "Art. 1", "Art. 2", use isso como divisor.
- Se o texto tem secoes em CAIXA ALTA ("CADASTRO DE LOCATARIOS", "RESPONSABILIDADE CIVIL"), cada secao vira 1 artigo.
- Se o texto tem lista numerada por topico ("1. Cadastro dos hospedes", "2. Responsabilidade civil"), cada item da lista vira 1 artigo.
- Se um topico tem subitens (1.1, 1.2 ou "- item"), agrupe tudo dentro do mesmo artigo.
- Ignore cabecalhos repetidos, paginacao, assinaturas e rodapes.

Responda SOMENTE com JSON valido no formato:
{"artigos":[{"numero":"Art. 1","titulo":"Cadastro dos hospedes","conteudo":"texto completo da regra..."}]}

Numero: "Art. 1", "Art. 2", etc. (sempre nesse formato, mesmo que o original use "1." ou "Secao 1").
Titulo: ate 80 chars, descritivo (nao copie a frase inteira).
Conteudo: texto completo do bloco daquela regra, ate 2000 chars.
Maximo 50 artigos. Nao invente conteudo. Se nao for um regimento estruturado, retorne {"artigos":[]}.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: truncado }],
      }),
    })
    if (!resp.ok) {
      console.warn('[parse] IA fallback HTTP', resp.status)
      return []
    }
    const data = await resp.json()
    const txt: string = data?.content?.[0]?.text ?? ''
    const match = txt.match(/\{[\s\S]*\}/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed?.artigos)) return []
    return parsed.artigos
      .filter((a: { numero?: string; titulo?: string; conteudo?: string }) => a?.numero && a?.titulo && a?.conteudo)
      .slice(0, 50)
      .map((a: { numero: string; titulo: string; conteudo: string }) => ({
        numero: String(a.numero).trim(),
        titulo: String(a.titulo).trim().slice(0, 200),
        conteudo: String(a.conteudo).trim().slice(0, MAX_ARTIGO_CHARS),
      }))
  } catch (e) {
    console.warn('[parse] IA fallback falhou:', (e as Error).message)
    return []
  }
}
