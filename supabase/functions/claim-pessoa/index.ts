// supabase/functions/claim-pessoa/index.ts
// Vincula o usuário logado ao registro de pessoa cadastrado pela administração.
// Usado quando o morador se cadastrou com email diferente do importado.
//
// Body: { cpf: string }
// Auth: JWT válido (morador logado)
// Retorna: o registro de pessoa vinculado

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getCaller } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const caller = await getCaller(req)
    const condoId = caller.perfil.condominio_id
    if (!condoId) return jsonResponse({ error: 'Usuário sem condomínio vinculado.' }, 400)

    const body = await req.json()
    const cpf: string = (body.cpf ?? '').replace(/\D/g, '')
    if (cpf.length < 11) return jsonResponse({ error: 'CPF inválido. Informe os 11 dígitos.' }, 400)

    // Não pode reivindicar se já tem pessoa vinculada
    const { data: jaTem } = await caller.admin
      .from('pessoas')
      .select('id')
      .eq('user_id', caller.userId)
      .maybeSingle()
    if (jaTem) return jsonResponse({ error: 'Você já tem um cadastro vinculado a esta conta.' }, 409)

    // Pega email do usuário logado
    const { data: { user } } = await caller.userClient.auth.getUser()
    const userEmail = user?.email ?? null

    // Busca pessoa pelo CPF no condomínio, sem user_id
    const { data: pessoa, error: findErr } = await caller.admin
      .from('pessoas')
      .select('id, nome, email, unidade_id, tipo_vinculo')
      .eq('condominio_id', condoId)
      .eq('cpf', cpf)
      .is('user_id', null)
      .maybeSingle()

    if (findErr) return jsonResponse({ error: `Erro na busca: ${findErr.message}` }, 500)
    if (!pessoa) {
      return jsonResponse(
        { error: 'CPF não encontrado nos cadastros do condomínio ou já possui conta vinculada.' },
        404,
      )
    }

    // Vincula: seta user_id e sincroniza email do auth
    const { error: updateErr } = await caller.admin
      .from('pessoas')
      .update({
        user_id: caller.userId,
        email: userEmail ?? pessoa.email,
      })
      .eq('id', pessoa.id)

    if (updateErr) return jsonResponse({ error: `Falha ao vincular: ${updateErr.message}` }, 500)

    return jsonResponse({
      ok: true,
      pessoa_id: pessoa.id,
      nome: pessoa.nome,
      tipo_vinculo: pessoa.tipo_vinculo,
      mensagem: 'Cadastro vinculado com sucesso.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonResponse({ error: msg }, 500)
  }
})
