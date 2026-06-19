// supabase/functions/onboarding-setup/index.ts
// Cadastro público de síndico + criação do condomínio em um único request.
// Não exige sessão prévia.
// Fluxo:
//  1. Recebe { nome, email, password, nome_condominio, num_unidades, cep?, cidade?, estado? }
//  2. Rate-limit por IP
//  3. Cria user no Auth (email_confirm = true)
//  4. Cria condominio
//  5. Cria perfil com role = 'sindico'
//  6. Cria assinatura trial de 10 dias (plano profissional)
//  7. Devolve sessão pronta pro front fazer setSession()

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

interface Body {
  nome: string
  email: string
  password: string
  nome_condominio: string
  num_unidades: string
  cep?: string | null
  cidade?: string | null
  estado?: string | null
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = (await req.json()) as Body
    const nome = body.nome?.trim()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const nome_condominio = body.nome_condominio?.trim()
    const num_unidades = body.num_unidades?.trim() || 'ate_30'
    const cep = body.cep?.trim() || null
    const cidade = body.cidade?.trim() || null
    const estado = body.estado?.trim() || null

    if (!nome || !email || !password || !nome_condominio) {
      return jsonResponse({ error: 'nome, email, password e nome_condominio são obrigatórios.' }, 400)
    }
    if (password.length < 8) {
      return jsonResponse({ error: 'Senha precisa ter no mínimo 8 caracteres.' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Rate limit: máx 5 cadastros/IP em 10 min
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('cf-connecting-ip')
            ?? 'unknown'
    const { data: allowed } = await admin.rpc('check_rate_limit', {
      p_bucket: 'onboarding_setup',
      p_identifier: ip,
      p_limit: 5,
      p_window_secs: 600,
    })
    if (allowed === false) {
      return jsonResponse({ error: 'Muitas tentativas. Aguarde 10 minutos.' }, 429)
    }

    // 1) Cria user no Auth
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_exibicao: nome },
    })
    if (authErr || !authData.user) {
      const msg = authErr?.message ?? 'Erro ao criar usuário.'
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        return jsonResponse({ error: 'Este e-mail já está cadastrado.' }, 400)
      }
      return jsonResponse({ error: msg }, 500)
    }
    const userId = authData.user.id

    // 2) Cria condomínio
    const { data: condo, error: condoErr } = await admin
      .from('condominios')
      .insert({
        nome: nome_condominio,
        cep,
        cidade,
        estado,
        ativo: true,
        permite_signup: true,
      })
      .select('id')
      .single()
    if (condoErr || !condo) {
      await admin.auth.admin.deleteUser(userId)
      return jsonResponse({ error: 'Erro ao criar condomínio.' }, 500)
    }
    const condoId = condo.id

    // 3) Cria perfil síndico
    const { error: perfilErr } = await admin
      .from('perfis')
      .insert({
        id: userId,
        condominio_id: condoId,
        role: 'sindico',
        nome_exibicao: nome,
        ativo: true,
      })
    if (perfilErr) {
      await admin.from('condominios').delete().eq('id', condoId)
      await admin.auth.admin.deleteUser(userId)
      return jsonResponse({ error: 'Erro ao criar perfil.' }, 500)
    }

    // 4) Cria assinatura trial 10 dias
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 10)
    await admin.from('assinaturas').insert({
      condominio_id: condoId,
      plano_id: 'profissional',
      status: 'trial',
      trial_ends_at: trialEnd.toISOString(),
      features_plano: {},
      features_extras: {},
    })

    // 5) Gera sessão para o cliente
    const anonClient = createClient(SUPABASE_URL, ANON_KEY)
    const { data: session, error: sessErr } = await anonClient.auth.signInWithPassword({ email, password })
    if (sessErr || !session.session) {
      return jsonResponse({ error: 'Conta criada, mas não foi possível iniciar sessão. Faça login manualmente.' }, 500)
    }

    return jsonResponse({
      session: session.session,
      condominio_id: condoId,
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro interno.' }, 500)
  }
})
