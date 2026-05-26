// supabase/functions/solicitar-exclusao-conta/index.ts
// LGPD: user solicita exclusão. Marca pessoa como inativa, bane user no Auth,
// e grava no audit_log com acao='lgpd.exclusao_solicitada' para revisão posterior.
// Exclusão definitiva é feita por admin_onway via outro fluxo (preserva auditoria).

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getCaller, HttpError, audit } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const caller = await getCaller(req)

    // Tenta encontrar a pessoa vinculada ao user
    const { data: pessoa } = await caller.admin
      .from('pessoas')
      .select('id, nome, condominio_id')
      .eq('user_id', caller.userId)
      .maybeSingle()

    // Desativa pessoa (se houver)
    if (pessoa) {
      await caller.admin.from('pessoas').update({ ativo: false }).eq('id', pessoa.id)
    }

    // Bane user no Auth (impede login)
    await caller.admin.auth.admin.updateUserById(caller.userId, {
      ban_duration: '876000h',
    })

    // Desativa perfil
    await caller.admin.from('perfis').update({ ativo: false }).eq('id', caller.userId)

    await audit(caller, req, {
      acao: 'lgpd.exclusao_solicitada',
      alvo_tipo: 'user',
      alvo_id: caller.userId,
      condominio_id: pessoa?.condominio_id ?? null,
      detalhes: { pessoa_id: pessoa?.id ?? null, nome: pessoa?.nome ?? null },
    })

    return jsonResponse({ ok: true, mensagem: 'Solicitação registrada.' })
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse({ error: e.message }, e.status)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
