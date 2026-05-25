// supabase/functions/generate-embedding/index.ts
// Recebe { artigo_id, text } e gera o embedding via Transformers.js (gte-small, local, gratuito).
// Atualiza a coluna `embedding` em regimento_artigos.
//
// Auth: usa service_role pra ignorar RLS no UPDATE (o controle de acesso é feito
// pela própria policy de UPDATE em regimento_artigos do usuário que chama).
//
// Deploy:  supabase functions deploy generate-embedding --no-verify-jwt=false
// Test:    curl -X POST <url>/functions/v1/generate-embedding \
//            -H "Authorization: Bearer <ANON_KEY_DO_USER>" \
//            -H "Content-Type: application/json" \
//            -d '{"artigo_id":"<uuid>", "text":"..."}'

import { createClient } from 'jsr:@supabase/supabase-js@2'
// @ts-expect-error: Deno-only import via esm.sh
import { pipeline } from 'https://esm.sh/@huggingface/transformers@3.0.2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

// Carrega o modelo uma vez na inicialização da function (cold start ~3-5s)
// @ts-expect-error: top-level await ok no Deno
const embedder = await pipeline('feature-extraction', 'Supabase/gte-small')

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    // O JWT do usuário precisa ser válido (Supabase valida antes da function rodar
    // se a function for deployed com verificação de JWT habilitada).
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization header obrigatório.' }, 401)
    }

    const { artigo_id, text } = await req.json()
    if (!artigo_id || typeof text !== 'string' || !text.trim()) {
      return jsonResponse({ error: 'artigo_id (uuid) e text (string não vazia) são obrigatórios.' }, 400)
    }

    // Gera embedding
    const output = await embedder(text, { pooling: 'mean', normalize: true })
    const embedding = Array.from(output.data) as number[]
    if (embedding.length !== 384) {
      return jsonResponse({
        error: `Embedding com dimensão inesperada: ${embedding.length} (esperado 384).`,
      }, 500)
    }

    // Usa service_role para o UPDATE (ignora RLS — o acesso é controlado
    // por quem CHAMA esta function, validado via JWT acima).
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
      return jsonResponse({ error: `Falha ao salvar embedding: ${upErr.message}` }, 500)
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
