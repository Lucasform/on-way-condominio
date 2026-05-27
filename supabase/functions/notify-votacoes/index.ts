// supabase/functions/notify-votacoes/index.ts
// FASE 15 / Leva C — roda a cada hora.
// Dispara push pra moradores em dois momentos:
//   - Abertura: votação ativa, data_inicio <= now() e push_abertura_at IS NULL
//   - Encerramento: votação ativa, data_fim no passado próximo e push_encerramento_at IS NULL

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function usuariosDoCondominio(admin: ReturnType<typeof createClient>, condominio_id: string): Promise<string[]> {
  const { data } = await admin
    .from('push_subscriptions')
    .select('user_id, perfis:user_id(condominio_id, ativo)')
    .eq('ativo', true)
  const ids = new Set<string>()
  for (const s of data ?? []) {
    const perfil = (s as { perfis?: { condominio_id: string | null; ativo: boolean } | null }).perfis
    if (!perfil?.ativo) continue
    if (perfil.condominio_id !== condominio_id) continue
    if (s.user_id) ids.add(s.user_id as string)
  }
  return Array.from(ids)
}

async function disparaPush(user_ids: string[], titulo: string, corpo: string, link: string): Promise<void> {
  if (user_ids.length === 0) return
  await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({ user_ids, titulo, corpo, link }),
  })
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const agora = new Date().toISOString()

    // Aberturas (votações que entraram no ar mas ainda não foram anunciadas)
    const { data: novas } = await admin
      .from('votacoes')
      .select('id, condominio_id, titulo, data_inicio, data_fim')
      .eq('status', 'aberta')
      .eq('ativo', true)
      .lte('data_inicio', agora)
      .is('push_abertura_at', null)
    for (const v of novas ?? []) {
      const ids = await usuariosDoCondominio(admin, v.condominio_id as string)
      const fim = v.data_fim ? ` Até ${new Date(v.data_fim as string).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.` : ''
      await disparaPush(ids, `🗳 Nova votação: ${v.titulo}`, `Sua participação conta.${fim}`, `/votacoes/${v.id}`)
      await admin.from('votacoes').update({ push_abertura_at: agora }).eq('id', v.id)
    }

    // Encerramentos próximos (24h antes do fim)
    const limite = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data: aFechar } = await admin
      .from('votacoes')
      .select('id, condominio_id, titulo, data_fim')
      .eq('status', 'aberta')
      .eq('ativo', true)
      .not('data_fim', 'is', null)
      .lte('data_fim', limite)
      .gte('data_fim', agora)
      .is('push_encerramento_at', null)
    for (const v of aFechar ?? []) {
      const ids = await usuariosDoCondominio(admin, v.condominio_id as string)
      const fim = v.data_fim ? new Date(v.data_fim as string).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
      await disparaPush(ids, `⏰ Última chance: ${v.titulo}`, `Votação encerra em ${fim}.`, `/votacoes/${v.id}`)
      await admin.from('votacoes').update({ push_encerramento_at: agora }).eq('id', v.id)
    }

    return jsonResponse({ aberturas: novas?.length ?? 0, encerramentos: aFechar?.length ?? 0 })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
