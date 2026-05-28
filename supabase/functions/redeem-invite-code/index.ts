// supabase/functions/redeem-invite-code/index.ts
// Signup público por código de convite. Não exige sessão.
// Fluxo:
//  1. Recebe { email, password, nome, codigo, unidade_id?, setor?, tipo_vinculo?, cpf?, telefone? }
//  2. Valida código via RPC consumir_convite (transação atômica)
//  3. Cria user no Auth com email_confirm=true (sem precisar confirmar e-mail)
//  4. Cria perfil já vinculado ao condomínio com role do código
//  5. Cria pessoa (se aplicável) com unidade/setor/tipo_vinculo coerentes
//  6. Devolve sessão pronta pro front fazer setSession()
//
// SEM AUTH header (chamada anônima).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

interface Body {
  email: string
  password: string
  nome: string
  codigo: string
  unidade_id?: string | null
  setor?: string | null
  tipo_vinculo?: string | null
  cpf?: string | null
  telefone?: string | null
}

// Papéis de gestão que não criam pessoa em /pessoas
const ROLES_SEM_PESSOA = new Set(['administradora', 'sindico', 'subsindico', 'conselheiro'])

// tipo_vinculo válido por role
const ROLE_DEFAULT_VINCULO: Record<string, string> = {
  morador: 'morador',
  portaria: 'funcionario',
  ronda: 'funcionario',
}
const VINCULOS_RESIDENCIAIS = new Set(['titular','conjuge','filho','dependente','inquilino','morador'])
const VINCULOS_VALIDOS = new Set(['titular','conjuge','filho','dependente','inquilino','morador','funcionario','outro'])

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = (await req.json()) as Body
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const nome = body.nome?.trim()
    const codigo = body.codigo?.trim().toUpperCase()
    const cpfRaw = body.cpf?.replace(/\D/g, '') || null
    const telefoneRaw = body.telefone?.trim() || null
    let unidadeReq: string | null = body.unidade_id?.trim() || null
    let setorReq: string | null = body.setor?.trim() || null
    let vinculoReq: string | null = body.tipo_vinculo?.trim() || null

    if (!email || !password || !nome || !codigo) {
      return jsonResponse({ error: 'email, password, nome e codigo são obrigatórios.' }, 400)
    }
    if (password.length < 8) {
      return jsonResponse({ error: 'Senha precisa ter no mínimo 8 caracteres.' }, 400)
    }
    if (vinculoReq && !VINCULOS_VALIDOS.has(vinculoReq)) {
      return jsonResponse({ error: `tipo_vinculo inválido: ${vinculoReq}` }, 400)
    }

    // Rate limit: máx 10 tentativas/IP em 10 min
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? req.headers.get('cf-connecting-ip')
            ?? 'unknown'
    const adminPre = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: allowed } = await adminPre.rpc('check_rate_limit', {
      p_bucket: 'redeem_invite',
      p_identifier: ip,
      p_limit: 10,
      p_window_secs: 600,
    })
    if (allowed === false) {
      return jsonResponse({ error: 'Muitas tentativas. Aguarde 10 minutos.' }, 429)
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

    const role: string = row.role
    const codigoUnidade: string | null = row.unidade_id ?? null
    const codigoSetor: string | null = row.setor ?? null
    const codigoVinculo: string | null = row.tipo_vinculo ?? null

    // Resolve vínculo final + unidade final + setor final
    // 1. Se código já travou, usa o do código (ignora payload).
    // 2. Senão, usa o payload.
    // 3. Senão, infere do role.
    const unidadeFinal: string | null = codigoUnidade ?? unidadeReq
    const setorFinal: string | null = codigoSetor ?? setorReq
    const vinculoFinal: string | null =
      codigoVinculo
      ?? vinculoReq
      ?? ROLE_DEFAULT_VINCULO[role]
      ?? null

    // Coerência: morador precisa de unidade; funcionário não precisa
    if (role === 'morador') {
      if (!unidadeFinal) {
        return jsonResponse({ error: 'Para signup de morador, selecione uma unidade.' }, 400)
      }
      if (vinculoFinal && !VINCULOS_RESIDENCIAIS.has(vinculoFinal)) {
        return jsonResponse({ error: 'Vínculo incompatível com papel morador.' }, 400)
      }
    }
    if ((role === 'portaria' || role === 'ronda') && vinculoFinal && vinculoFinal !== 'funcionario') {
      return jsonResponse({ error: 'Vínculo incompatível com papel funcionário.' }, 400)
    }

    // Valida que unidade pertence ao condomínio do código
    if (unidadeFinal) {
      const { data: uni } = await admin
        .from('unidades')
        .select('id, condominio_id')
        .eq('id', unidadeFinal)
        .maybeSingle()
      if (!uni || uni.condominio_id !== row.condominio_id) {
        return jsonResponse({ error: 'Unidade inválida pra esse condomínio.' }, 400)
      }
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
      role,
      nome_exibicao: nome,
    })
    if (pErr) {
      await admin.auth.admin.deleteUser(userId)
      return jsonResponse({ error: `Falha ao criar perfil: ${pErr.message}` }, 500)
    }

    // 4) Cria pessoa quando faz sentido (morador, portaria, ronda)
    let pessoaId: string | null = null
    if (!ROLES_SEM_PESSOA.has(role)) {
      const pessoaPayload: Record<string, unknown> = {
        condominio_id: row.condominio_id,
        user_id: userId,
        nome,
        tipo_vinculo: vinculoFinal ?? 'morador',
        email,
        ativo: true,
      }
      if (unidadeFinal) pessoaPayload.unidade_id = unidadeFinal
      if (cpfRaw) pessoaPayload.cpf = cpfRaw
      if (telefoneRaw) pessoaPayload.telefone = telefoneRaw
      // setor: hoje não há coluna dedicada em pessoas; persistimos via relacao_unidade=null + futuro campo.
      // Por ora, salva em metadados informais? Não há coluna. Ignora setor por enquanto se não tiver lugar.
      // → setor é guardado no convite + audit_log, não em pessoas (pessoas.setor não existe).

      const { data: novaPessoa, error: psErr } = await admin
        .from('pessoas')
        .insert(pessoaPayload)
        .select('id')
        .single()
      if (psErr) {
        // Não derruba o signup; perfil já existe. Loga warning.
        console.warn('[redeem-invite] criar pessoa falhou:', psErr.message)
      } else {
        pessoaId = novaPessoa.id
      }
    }

    // 5) Inicia sessão pro front
    const userClient = createClient(SUPABASE_URL, ANON_KEY)
    const { data: session, error: sErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    })

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
        ator_role: role,
        ator_email: email,
        condominio_id: row.condominio_id,
        acao: 'convite.resgatado',
        alvo_tipo: 'user',
        alvo_id: userId,
        detalhes: { codigo, role, unidade_id: unidadeFinal, setor: setorFinal, tipo_vinculo: vinculoFinal, pessoa_id: pessoaId },
        ip: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip'),
        user_agent: req.headers.get('user-agent'),
      })
    } catch (_) { /* não derruba */ }

    if (sErr || !session?.session) {
      return jsonResponse({
        ok: true,
        message: 'Conta criada. Faça login.',
        no_session: true,
      })
    }

    return jsonResponse({
      ok: true,
      condominio_id: row.condominio_id,
      role,
      pessoa_id: pessoaId,
      session: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
      },
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
