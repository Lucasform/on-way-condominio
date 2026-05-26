// supabase/functions/reset-senha-usuario/index.ts
// Admin/sindico/administradora força reset de senha de outro user.
// Gera link de recovery via Admin API e dispara email automaticamente.
//
// Body: { pessoa_id: uuid }
// Auth: JWT de staff

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  getCaller,
  canManagePessoas,
  assertSameScope,
  HttpError,
  audit,
} from '../_shared/auth.ts'

interface Body {
  pessoa_id: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { pessoa_id } = (await req.json()) as Body
    if (!pessoa_id) return jsonResponse({ error: 'pessoa_id obrigatório.' }, 400)

    const caller = await getCaller(req)
    if (!canManagePessoas(caller.perfil.role)) {
      return jsonResponse({ error: 'Sem permissão.' }, 403)
    }

    const { data: pessoa, error: pErr } = await caller.admin
      .from('pessoas')
      .select('id, nome, email, condominio_id, user_id')
      .eq('id', pessoa_id)
      .single()
    if (pErr || !pessoa) return jsonResponse({ error: 'Pessoa não encontrada.' }, 404)
    assertSameScope(caller, pessoa.condominio_id)

    if (!pessoa.email) return jsonResponse({ error: 'Pessoa sem e-mail.' }, 400)
    if (!pessoa.user_id) return jsonResponse({ error: 'Pessoa ainda sem conta. Use Convidar.' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const siteUrl = SUPABASE_URL.includes('lkxnngzgmyfqgbbpmjvc')
      ? 'https://on-way-condominio.vercel.app'
      : SUPABASE_URL

    // generateLink dispara o e-mail via SMTP configurado no Auth.
    const { error: linkErr } = await caller.admin.auth.admin.generateLink({
      type: 'recovery',
      email: pessoa.email,
      options: { redirectTo: `${siteUrl}/atualizar-senha` },
    })
    if (linkErr) return jsonResponse({ error: `Falha: ${linkErr.message}` }, 500)

    await audit(caller, req, {
      acao: 'usuario.reset_senha_solicitado',
      alvo_tipo: 'user',
      alvo_id: pessoa.user_id,
      condominio_id: pessoa.condominio_id,
      detalhes: { pessoa_id, email: pessoa.email },
    })

    return jsonResponse({
      ok: true,
      pessoa_id,
      email: pessoa.email,
      mensagem: `Link de redefinição enviado pra ${pessoa.email}.`,
    })
  } catch (e) {
    if (e instanceof HttpError) {
      return jsonResponse({ error: e.message }, e.status)
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
