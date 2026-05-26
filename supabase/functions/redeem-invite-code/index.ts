// supabase/functions/redeem-invite-code/index.ts
// Signup público por código de convite. Não exige sessão.
// Fluxo:
//  1. Recebe { email, password, nome, codigo }
//  2. Valida código via RPC consumir_convite (transação atômica)
//  3. Cria user no Auth com email_confirm=true (sem precisar confirmar e-mail)
//  4. Cria perfil já vinculado ao condomínio com role do código
//  5. Devolve sessão pronta pro front fazer setSession()
//
// SEM AUTH header (chamada anônima).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

interface Body {
  email: string
  password: string
  nome: string
  codigo: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = (await req.json()) as Body
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const nome = body.nome?.trim()
    const codigo = body.codigo?.trim().toUpperCase()

    if (!email || !password || !nome || !codigo) {
      return jsonResponse({ error: 'email, password, nome e codigo são obrigatórios.' }, 400)
    }
    if (password.length < 6) {
      return jsonResponse({ error: 'Senha precisa ter no mínimo 6 caracteres.' }, 400)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1) Valida e consome código (atomicamente)
    const { data: consume, error: cErr } = await admin.rpc('consumir_convite', { p_codigo: codigo })
    if (cErr) return jsonResponse({ error: `Falha ao validar código: ${cErr.message}` }, 500)
    const row = Array.isArray(consume) ? consume[0] : consume
    if (!row?.ok) {
      const motivos: Record<string, string> = {
        codigo_nao_encontrado: 'Código não encontrado.',
        revogado: 'Código foi revogado.',
        expirado: 'Código expirado.',
        esgotado: 'Código já atingiu o limite de usos.',
      }
      return jsonResponse({ error: motivos[row?.motivo ?? ''] ?? 'Código inválido.' }, 400)
    }

    // 2) Cria user com e-mail já confirmado (síndico tá vouching pelo código)
    const { data: created, error: uErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (uErr || !created?.user) {
      // Reverte: decrementa uso do código (best-effort)
      await admin
        .from('convites_condominio')
        .update({ usos: row.usos > 0 ? row.usos - 1 : 0 })
        .eq('codigo', codigo)
      const msg = uErr?.message ?? 'Falha ao criar usuário.'
      const friendly =
        msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')
          ? 'Esse e-mail já tem conta. Vá em "Entrar".'
          : msg
      return jsonResponse({ error: friendly }, 400)
    }

    const userId = created.user.id

    // 3) Cria perfil
    const { error: pErr } = await admin.from('perfis').insert({
      id: userId,
      condominio_id: row.condominio_id,
      role: row.role,
      nome_exibicao: nome,
    })
    if (pErr) {
      // Reverte user pra não deixar conta órfã
      await admin.auth.admin.deleteUser(userId)
      return jsonResponse({ error: `Falha ao criar perfil: ${pErr.message}` }, 500)
    }

    // 4) Inicia sessão pro front
    const userClient = createClient(SUPABASE_URL, ANON_KEY)
    const { data: session, error: sErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    })
    if (sErr || !session?.session) {
      return jsonResponse({
        ok: true,
        message: 'Conta criada. Faça login.',
        no_session: true,
      })
    }

    // Boas-vindas (fire-and-forget)
    try {
      const { data: condo } = await admin
        .from('condominios')
        .select('nome')
        .eq('id', row.condominio_id)
        .maybeSingle()
      await admin.functions.invoke('send-email', {
        body: {
          to: email,
          template: 'boas-vindas',
          vars: {
            morador_nome: nome,
            condominio_nome: condo?.nome,
            link: 'https://on-way-condominio.vercel.app',
          },
          condominio_id: row.condominio_id,
        },
      })
    } catch (_) { /* não derruba */ }

    // Audit (sem caller — gravando direto via admin)
    try {
      await admin.from('audit_log').insert({
        ator_id: userId,
        ator_role: row.role,
        ator_email: email,
        condominio_id: row.condominio_id,
        acao: 'convite.resgatado',
        alvo_tipo: 'user',
        alvo_id: userId,
        detalhes: { codigo, role: row.role },
        ip: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip'),
        user_agent: req.headers.get('user-agent'),
      })
    } catch (_) { /* não derruba */ }

    return jsonResponse({
      ok: true,
      condominio_id: row.condominio_id,
      role: row.role,
      session: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
