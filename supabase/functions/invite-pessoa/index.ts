// supabase/functions/invite-pessoa/index.ts
// Convida uma pessoa pra criar conta:
//  1. Lê pessoa do banco (precisa ter email + condominio_id)
//  2. Cria user via Supabase Auth Admin (sem senha, magic link)
//  3. Linka pessoa.user_id
//  4. Cria perfil com role 'morador'
//  5. Supabase manda email de convite com link mágico
//
// Body: { pessoa_id: uuid }
// Auth: JWT do staff (admin/administradora/sindico)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

interface Body {
  pessoa_id: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return jsonResponse({ error: 'Authorization obrigatório.' }, 401)

    const { pessoa_id } = (await req.json()) as Body
    if (!pessoa_id) return jsonResponse({ error: 'pessoa_id obrigatório.' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    // Cliente com JWT do user pra checar permissão via RLS
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    })

    // Verifica que quem chama tem permissão (RLS no SELECT)
    const { data: pessoa, error: pErr } = await userClient
      .from('pessoas')
      .select('id, nome, email, condominio_id, user_id')
      .eq('id', pessoa_id)
      .single()

    if (pErr || !pessoa) {
      return jsonResponse({ error: 'Pessoa não encontrada ou sem acesso.' }, 404)
    }
    if (!pessoa.email) {
      return jsonResponse({ error: 'Pessoa não tem e-mail cadastrado.' }, 400)
    }
    if (pessoa.user_id) {
      return jsonResponse({ error: 'Pessoa já tem conta vinculada.' }, 409)
    }

    // Cliente admin pra criar user + linkar
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Tenta encontrar user já existente pelo email
    const { data: existentes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    let userId: string | null = null
    if (existentes?.users) {
      const found = existentes.users.find((u) => u.email?.toLowerCase() === pessoa.email!.toLowerCase())
      if (found) userId = found.id
    }

    // Se não existe, manda convite (cria user + envia email com link mágico)
    if (!userId) {
      const siteUrl = SUPABASE_URL.includes('lkxnngzgmyfqgbbpmjvc')
        ? 'https://on-way-condominio.vercel.app'
        : SUPABASE_URL
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
        pessoa.email,
        {
          redirectTo: `${siteUrl}/auth/callback`,
          data: { nome: pessoa.nome },
        },
      )
      if (invErr) {
        return jsonResponse({ error: `Falha no convite: ${invErr.message}` }, 500)
      }
      userId = invited.user?.id ?? null
      if (!userId) return jsonResponse({ error: 'Convite criado mas user_id ausente.' }, 500)
    }

    // Linka pessoa.user_id
    const { error: linkErr } = await admin
      .from('pessoas')
      .update({ user_id: userId })
      .eq('id', pessoa_id)
    if (linkErr) {
      return jsonResponse({ error: `Falha ao linkar: ${linkErr.message}` }, 500)
    }

    // Cria perfil (se ainda não existe)
    const { data: perfilExistente } = await admin
      .from('perfis')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!perfilExistente) {
      const { error: pErr } = await admin.from('perfis').insert({
        id: userId,
        condominio_id: pessoa.condominio_id,
        role: 'morador',
        nome_exibicao: pessoa.nome,
      })
      if (pErr) {
        return jsonResponse({ error: `Falha ao criar perfil: ${pErr.message}` }, 500)
      }
    }

    return jsonResponse({
      ok: true,
      pessoa_id,
      user_id: userId,
      email: pessoa.email,
      mensagem: 'Convite enviado por email. Morador receberá link pra ativar a conta.',
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
