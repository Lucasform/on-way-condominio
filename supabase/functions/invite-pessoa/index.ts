// supabase/functions/invite-pessoa/index.ts
// Convida uma pessoa pra criar conta:
//  1. Valida que quem chama pode criar o role solicitado
//  2. Lê pessoa do banco (precisa ter email + condominio_id)
//  3. Cria user via Supabase Auth Admin (sem senha, magic link)
//  4. Linka pessoa.user_id
//  5. Cria perfil com role solicitado (default 'morador')
//
// Body: { pessoa_id: uuid, role?: Role }
// Auth: JWT de staff (admin_onway/administradora/sindico)

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  getCaller,
  canCreateRole,
  assertSameScope,
  HttpError,
  audit,
  type Role,
} from '../_shared/auth.ts'

interface Body {
  pessoa_id: string
  role?: Role
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { pessoa_id, role = 'morador' } = (await req.json()) as Body
    if (!pessoa_id) return jsonResponse({ error: 'pessoa_id obrigatório.' }, 400)

    const caller = await getCaller(req)
    if (!canCreateRole(caller.perfil.role, role)) {
      return jsonResponse(
        { error: `Seu perfil (${caller.perfil.role}) não pode criar role "${role}".` },
        403,
      )
    }

    // SELECT via userClient: RLS valida acesso à pessoa
    const { data: pessoa, error: pErr } = await caller.userClient
      .from('pessoas')
      .select('id, nome, email, condominio_id, user_id')
      .eq('id', pessoa_id)
      .single()

    if (pErr || !pessoa) {
      return jsonResponse({ error: 'Pessoa não encontrada ou sem acesso.' }, 404)
    }
    if (!pessoa.email) return jsonResponse({ error: 'Pessoa não tem e-mail.' }, 400)
    if (pessoa.user_id) return jsonResponse({ error: 'Pessoa já tem conta vinculada.' }, 409)
    assertSameScope(caller, pessoa.condominio_id)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const siteUrl = SUPABASE_URL.includes('lkxnngzgmyfqgbbpmjvc')
      ? 'https://on-way-condominio.vercel.app'
      : SUPABASE_URL

    // Procura user existente pelo email
    let userId: string | null = null
    const { data: existentes } = await caller.admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (existentes?.users) {
      const found = existentes.users.find(
        (u) => u.email?.toLowerCase() === pessoa.email!.toLowerCase(),
      )
      if (found) userId = found.id
    }

    if (!userId) {
      const { data: invited, error: invErr } = await caller.admin.auth.admin.inviteUserByEmail(
        pessoa.email,
        {
          redirectTo: `${siteUrl}/auth/callback`,
          data: { nome: pessoa.nome },
        },
      )
      if (invErr) return jsonResponse({ error: `Falha no convite: ${invErr.message}` }, 500)
      userId = invited.user?.id ?? null
      if (!userId) return jsonResponse({ error: 'Convite criado mas user_id ausente.' }, 500)
    }

    // Linka pessoa.user_id
    const { error: linkErr } = await caller.admin
      .from('pessoas')
      .update({ user_id: userId })
      .eq('id', pessoa_id)
    if (linkErr) return jsonResponse({ error: `Falha ao linkar: ${linkErr.message}` }, 500)

    // Cria perfil (idempotente)
    const { data: perfilExistente } = await caller.admin
      .from('perfis')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle()

    if (!perfilExistente) {
      const { error: pInsErr } = await caller.admin.from('perfis').insert({
        id: userId,
        condominio_id: pessoa.condominio_id,
        role,
        nome_exibicao: pessoa.nome,
      })
      if (pInsErr) return jsonResponse({ error: `Falha ao criar perfil: ${pInsErr.message}` }, 500)
    } else if (perfilExistente.role !== role) {
      // Perfil já existia com outro role — atualiza somente se o caller pode
      const { error: pUpdErr } = await caller.admin
        .from('perfis')
        .update({ role, condominio_id: pessoa.condominio_id })
        .eq('id', userId)
      if (pUpdErr) return jsonResponse({ error: `Falha ao atualizar perfil: ${pUpdErr.message}` }, 500)
    }

    await audit(caller, req, {
      acao: 'pessoa.convidada',
      alvo_tipo: 'pessoa',
      alvo_id: pessoa_id,
      condominio_id: pessoa.condominio_id,
      detalhes: { role, email: pessoa.email, user_id: userId },
    })

    return jsonResponse({
      ok: true,
      pessoa_id,
      user_id: userId,
      email: pessoa.email,
      role,
      mensagem: 'Convite enviado por e-mail.',
    })
  } catch (e) {
    if (e instanceof HttpError) {
      return jsonResponse({ error: e.message }, e.status)
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
