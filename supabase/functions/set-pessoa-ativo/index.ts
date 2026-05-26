// supabase/functions/set-pessoa-ativo/index.ts
// Ativa ou desativa uma Pessoa. Quando desativa e pessoa tem user_id vinculado,
// bane a conta no auth.users (banned_until=2099) pra impedir login imediatamente.
// Quando reativa, remove o ban.
//
// Body: { pessoa_id: uuid, ativo: boolean }
// Auth: JWT de staff (admin_onway / administradora / sindico)

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  getCaller,
  canManagePessoas,
  assertSameScope,
  HttpError,
} from '../_shared/auth.ts'

interface Body {
  pessoa_id: string
  ativo: boolean
}

const BANNED_UNTIL_2099 = '2099-12-31T23:59:59Z'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { pessoa_id, ativo } = (await req.json()) as Body
    if (!pessoa_id || typeof ativo !== 'boolean') {
      return jsonResponse({ error: 'pessoa_id e ativo obrigatórios.' }, 400)
    }

    const caller = await getCaller(req)
    if (!canManagePessoas(caller.perfil.role)) {
      return jsonResponse({ error: 'Sem permissão pra gerenciar pessoas.' }, 403)
    }

    // Busca pessoa via admin (RLS já validou role acima, mas vamos confirmar escopo)
    const { data: pessoa, error: pErr } = await caller.admin
      .from('pessoas')
      .select('id, nome, condominio_id, user_id, ativo')
      .eq('id', pessoa_id)
      .single()
    if (pErr || !pessoa) return jsonResponse({ error: 'Pessoa não encontrada.' }, 404)
    assertSameScope(caller, pessoa.condominio_id)

    // Atualiza pessoa.ativo
    const { error: updErr } = await caller.admin
      .from('pessoas')
      .update({ ativo })
      .eq('id', pessoa_id)
    if (updErr) return jsonResponse({ error: `Falha ao atualizar: ${updErr.message}` }, 500)

    // Sincroniza auth.users.banned_until (se houver conta)
    let auth_synced = false
    if (pessoa.user_id) {
      const { error: banErr } = await caller.admin.auth.admin.updateUserById(pessoa.user_id, {
        ban_duration: ativo ? 'none' : '876000h', // ~100 anos; 'none' desbane
      })
      if (banErr) {
        // Não derruba a operação: pessoa já foi atualizada. Loga warning.
        console.warn('[set-pessoa-ativo] banUser falhou:', banErr.message)
      } else {
        auth_synced = true
      }
    }

    return jsonResponse({
      ok: true,
      pessoa_id,
      ativo,
      auth_synced,
      mensagem: ativo
        ? 'Pessoa reativada.'
        : `Pessoa desativada${pessoa.user_id ? ' e login bloqueado' : ''}.`,
    })
  } catch (e) {
    if (e instanceof HttpError) {
      return jsonResponse({ error: e.message }, e.status)
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
