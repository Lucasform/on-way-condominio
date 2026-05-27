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
// @ts-expect-error: legacy build do pdfjs roda em Deno sem worker
import { getDocument, GlobalWorkerOptions } from 'npm:pdfjs-dist@4.7.76/legacy/build/pdf.mjs'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

// Desabilita worker (rodamos no main thread do Edge runtime).
// @ts-expect-error: tipo do GlobalWorkerOptions
GlobalWorkerOptions.workerSrc = ''

// @ts-expect-error: Supabase.ai injetado pelo runtime
const aiSession = new Supabase.ai.Session('gte-small')

const MAX_MODELO_CHARS = 3000
const MAX_ARTIGO_CHARS = 2000

Deno.serve(async (req: Request) => {
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
    const artigos = dividirEmArtigos(texto)
    if (artigos.length === 0) {
      return jsonResponse({
        error: 'Não encontramos padrões "Art. X" no PDF. Cadastre artigos manualmente.',
      }, 422)
    }

    // Insere artigos. Convenção: 'numero' = "Art. X", 'titulo' = primeira linha, 'conteudo' = resto
    let criados = 0
    for (const a of artigos) {
      // Verifica se já existe esse "Art. X" pra evitar duplicar a cada reprocessamento
      const { data: existente } = await admin
        .from('regimento_artigos')
        .select('id')
        .eq('condominio_id', condominio_id)
        .eq('numero', a.numero)
        .maybeSingle()
      if (existente) continue

      const conteudo = a.conteudo.slice(0, MAX_ARTIGO_CHARS)
      const titulo = a.titulo.slice(0, 200) || a.numero

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

  const loadingTask = getDocument({ data, useWorker: false, disableFontFace: true, isEvalSupported: false })
  const pdf = await loadingTask.promise
  const partes: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const linhaAtual: string[] = []
    let yPrev: number | null = null
    for (const item of content.items as Array<{ str: string; transform?: number[] }>) {
      const y = item.transform?.[5] ?? null
      if (yPrev !== null && y !== null && Math.abs(y - yPrev) > 2) {
        partes.push(linhaAtual.join(' '))
        linhaAtual.length = 0
      }
      if (item.str) linhaAtual.push(item.str)
      yPrev = y
    }
    if (linhaAtual.length) partes.push(linhaAtual.join(' '))
    partes.push('') // separador de página
  }
  return partes.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
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
