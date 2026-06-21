// supabase/functions/onboarding-setup/index.ts
// Cadastro público de síndico + criação do condomínio.
// Usa inserts diretos via service-role (mesmo padrão do redeem-invite-code).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

interface Body {
  nome: string
  email: string
  password: string
  nome_condominio: string
  num_unidades?: string
  cep?: string | null
  cidade?: string | null
  estado?: string | null
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!

  try {
    const body = (await req.json()) as Body
    const nome            = body.nome?.trim()
    const email           = body.email?.trim().toLowerCase()
    const password        = body.password
    const nome_condominio = body.nome_condominio?.trim()
    const cep             = body.cep?.trim() || null
    const cidade          = body.cidade?.trim() || null
    const estado          = body.estado?.trim() || null

    if (!nome || !email || !password || !nome_condominio) {
      return jsonResponse({ error: 'nome, email, password e nome_condominio são obrigatórios.' }, 400)
    }
    if (password.length < 8) {
      return jsonResponse({ error: 'Senha precisa ter no mínimo 8 caracteres.' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { data: allowed } = await admin.rpc('check_rate_limit', {
      p_bucket: 'onboarding_setup',
      p_identifier: ip,
      p_limit: 5,
      p_window_secs: 600,
    })
    if (allowed === false) {
      return jsonResponse({ error: 'Muitas tentativas. Aguarde 10 minutos.' }, 429)
    }

    // 1) Verifica se e-mail já existe (getUserByEmail é O(1), listUsers seria O(n))
    const { data: existingUser } = await admin.auth.admin.getUserByEmail(email)
    if (existingUser?.user) {
      return jsonResponse({ error: 'Este e-mail já está cadastrado.' }, 400)
    }

    // 2) Cria user no Auth
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_exibicao: nome },
    })
    if (authErr || !authData?.user) {
      const msg = authErr?.message ?? 'Erro ao criar usuário.'
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        return jsonResponse({ error: 'Este e-mail já está cadastrado.' }, 400)
      }
      return jsonResponse({ error: msg }, 500)
    }
    const userId = authData.user.id

    // 3) Cria condomínio via REST direto (bypassa schema cache do PostgREST)
    const trialEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const restUrl = `${SUPABASE_URL}/rest/v1`

    const condoRes = await fetch(`${restUrl}/condominios?select=id`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ nome: nome_condominio, cep, cidade, estado, ativo: true, permite_signup: true }),
    })
    if (!condoRes.ok) {
      const condoErr = await condoRes.text()
      await admin.auth.admin.deleteUser(userId)
      return jsonResponse({ error: `Erro ao criar condomínio: ${condoErr}` }, 500)
    }
    const condoRows = await condoRes.json() as { id: string }[]
    const condoId = condoRows[0]?.id
    if (!condoId) {
      await admin.auth.admin.deleteUser(userId)
      return jsonResponse({ error: 'Condomínio não retornou ID.' }, 500)
    }

    // 4) Cria perfil síndico
    const perfilRes = await fetch(`${restUrl}/perfis`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ id: userId, condominio_id: condoId, role: 'sindico', nome_exibicao: nome, ativo: true }),
    })
    if (!perfilRes.ok) {
      const perfilErr = await perfilRes.text()
      await fetch(`${restUrl}/condominios?id=eq.${condoId}`, { method: 'DELETE', headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } })
      await admin.auth.admin.deleteUser(userId)
      return jsonResponse({ error: `Erro ao criar perfil: ${perfilErr}` }, 500)
    }

    // 5) Cria assinatura trial
    await fetch(`${restUrl}/assinaturas`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({ condominio_id: condoId, plano_id: 'profissional', status: 'trial', trial_ends_at: trialEnd, features_plano: {}, features_extras: {} }),
    })

    // 6) Gera sessão
    const anonClient = createClient(SUPABASE_URL, ANON_KEY)
    const { data: session, error: sessErr } = await anonClient.auth.signInWithPassword({ email, password })
    if (sessErr || !session?.session) {
      return jsonResponse({ ok: true, condominio_id: condoId, session: null, message: 'Conta criada. Faça login.' })
    }

    return jsonResponse({ session: session.session, condominio_id: condoId })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro interno.' }, 500)
  }
})
