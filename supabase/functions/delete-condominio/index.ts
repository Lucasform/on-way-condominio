// supabase/functions/delete-condominio/index.ts
// Apaga um condominio em cascata, incluindo TODOS os usuarios (auth.users)
// associados via perfis. So admin_onway pode chamar.
//
// Body: { condominio_id }
// Retorna: { ok: true, deletados: { users, condominio } }
//
// Ordem segura:
//   1. Lista user_ids de perfis vinculados a este condo
//   2. Apaga cada user no auth (cascata derruba perfil row e qualquer FK)
//   3. Apaga o condominio (cascata derruba unidades, pessoas, ocorrencias,
//      multas, chamados, encomendas, comunicados, mural, calendario,
//      assembleias, votacoes, chat, etc — tudo tem ON DELETE CASCADE)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    // Confirma identidade do caller pelo token
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: u } = await userClient.auth.getUser()
    const caller = u?.user
    if (!caller) return jsonResponse({ error: 'Sessão inválida.' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // So admin_onway pode acionar
    const { data: perfilCaller } = await admin
      .from('perfis')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()
    if (perfilCaller?.role !== 'admin_onway') {
      return jsonResponse({ error: 'Apenas o administrador OnWay pode excluir um condomínio.' }, 403)
    }

    const body = await req.json()
    const condominio_id: string | undefined = body?.condominio_id
    if (!condominio_id) return jsonResponse({ error: 'condominio_id obrigatório.' }, 400)

    // Confirma que o condo existe
    const { data: condo } = await admin
      .from('condominios')
      .select('id, nome')
      .eq('id', condominio_id)
      .maybeSingle()
    if (!condo) return jsonResponse({ error: 'Condomínio não encontrado.' }, 404)

    // 1) Lista users do condo (excluindo o proprio admin_onway pra nao se autoexcluir)
    const { data: perfis } = await admin
      .from('perfis')
      .select('id, role')
      .eq('condominio_id', condominio_id)

    const userIds = ((perfis ?? []) as Array<{ id: string; role: string }>)
      .filter((p) => p.id !== caller.id) // proteção: nunca apaga o próprio admin
      .map((p) => p.id)

    let usersDeletados = 0
    let usersFalhas: Array<{ id: string; erro: string }> = []
    for (const uid of userIds) {
      try {
        const { error } = await admin.auth.admin.deleteUser(uid)
        if (error) {
          usersFalhas.push({ id: uid, erro: error.message })
        } else {
          usersDeletados++
        }
      } catch (e) {
        usersFalhas.push({ id: uid, erro: e instanceof Error ? e.message : 'erro' })
      }
    }

    // 2) Apaga o condominio (cascade pega todo o resto)
    const { error: errCondo } = await admin
      .from('condominios')
      .delete()
      .eq('id', condominio_id)
    if (errCondo) {
      return jsonResponse({
        error: 'Falha ao apagar condomínio: ' + errCondo.message,
        users_deletados: usersDeletados,
        users_falhas: usersFalhas,
      }, 500)
    }

    return jsonResponse({
      ok: true,
      deletados: {
        users: usersDeletados,
        users_falhas: usersFalhas,
        condominio: condo.nome,
      },
    })
  } catch (e) {
    console.error('[delete-condominio] erro:', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 500)
  }
})
