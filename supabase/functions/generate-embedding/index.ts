// supabase/functions/generate-embedding/index.ts
// Gera embedding via API NATIVA Supabase.ai.Session('gte-small') — sem dependência externa.
// Atualiza a coluna `embedding` em regimento_artigos.
//
// Body: { artigo_id: uuid, text: string }
// Auth: requer JWT válido (service_role OU user logado com permissão).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

// API nativa de inferência ML do Supabase Edge Runtime.
// gte-small = 384 dimensões, ótimo para PT-BR.
// @ts-expect-error: Supabase.ai é injetado pelo runtime, não tem types globais
const session = new Supabase.ai.Session('gte-small')

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization header obrigatório.' }, 401)

    const { artigo_id, text } = await req.json()
    if (!artigo_id || typeof text !== 'string' || !text.trim()) {
      return jsonResponse(
        { error: 'artigo_id (uuid) e text (string não vazia) são obrigatórios.' },
        400,
      )
    }

    // Gera embedding usando a sessão Supabase.ai
    const output = await session.run(text, { mean_pool: true, normalize: true })
    const embedding = Array.isArray(output) ? output : Array.from(output as number[])

    if (embedding.length !== 384) {
      return jsonResponse(
        { error: `Embedding com dimensão inesperada: ${embedding.length} (esperado 384).` },
        500,
      )
    }

    // Salva no banco usando service_role (ignora RLS)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: upErr } = await admin
      .from('regimento_artigos')
      .update({
        embedding,
        embedding_atualizado_em: new Date().toISOString(),
      })
      .eq('id', artigo_id)

    if (upErr) {
      return jsonResponse({ error: `Falha ao salvar: ${upErr.message}` }, 500)
    }

    return jsonResponse({
      ok: true,
      artigo_id,
      dims: embedding.length,
      sample: embedding.slice(0, 3),
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
