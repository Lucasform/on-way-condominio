import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    const { codigo, email, password, nome } = await req.json()
    if (!codigo || !email || !password || !nome) {
      return Response.json({ error: 'Campos obrigatórios: codigo, email, password, nome' }, { status: 400, headers: corsHeaders })
    }

    // 1. Validar convite
    const { data: convite, error: errConvite } = await admin
      .from('convites_plataforma')
      .select('*')
      .eq('codigo', codigo.toUpperCase().trim())
      .single()

    if (errConvite || !convite) {
      return Response.json({ error: 'Código de convite inválido.' }, { status: 404, headers: corsHeaders })
    }
    if (convite.revogado) {
      return Response.json({ error: 'Este convite foi revogado.' }, { status: 403, headers: corsHeaders })
    }
    if (new Date(convite.expira_em) < new Date()) {
      return Response.json({ error: 'Este convite expirou.' }, { status: 403, headers: corsHeaders })
    }
    if (convite.usos >= convite.usos_max) {
      return Response.json({ error: 'Este convite já atingiu o limite de usos.' }, { status: 403, headers: corsHeaders })
    }

    // 2. Criar usuário no Supabase Auth
    const { data: authData, error: errAuth } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_exibicao: nome },
    })
    if (errAuth || !authData.user) {
      const msg = errAuth?.message ?? 'Erro ao criar usuário.'
      return Response.json({ error: msg }, { status: 400, headers: corsHeaders })
    }

    const userId = authData.user.id

    // 3. Criar perfil com role='parceiro' e condominio_id=null
    const { error: errPerfil } = await admin
      .from('perfis')
      .insert({
        id: userId,
        condominio_id: null,
        role: 'parceiro',
        nome_exibicao: nome.trim(),
      })
    if (errPerfil) {
      // Rollback: remover o usuário criado
      await admin.auth.admin.deleteUser(userId)
      return Response.json({ error: `Erro ao criar perfil: ${errPerfil.message}` }, { status: 500, headers: corsHeaders })
    }

    // 4. Incrementar usos do convite
    await admin
      .from('convites_plataforma')
      .update({ usos: convite.usos + 1 })
      .eq('id', convite.id)

    return Response.json({ ok: true, user_id: userId }, { headers: corsHeaders })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders })
  }
})
