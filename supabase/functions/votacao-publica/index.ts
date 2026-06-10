// supabase/functions/votacao-publica/index.ts
// Voto público via QR/link (sem login). Só funciona em votações modo 'qrcode'.
// action 'info'  -> dados públicos da votação + opções + unidades (sem código nem votos)
// action 'votar' -> registra voto de convidado (1 por unidade, código quando exigido)
//
// Roda com service_role (deploy --no-verify-jwt). NÃO expõe codigo_acesso nem votos.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json().catch(() => ({}))
    const action: string = body.action
    const votacaoId: string = body.votacao_id

    if (!votacaoId) return jsonResponse({ error: 'votacao_id obrigatório.' }, 400)

    const { data: votacao } = await admin
      .from('votacoes')
      .select('id, condominio_id, titulo, descricao, status, modo, codigo_acesso, data_inicio, data_fim, ativo')
      .eq('id', votacaoId)
      .maybeSingle()

    if (!votacao || !votacao.ativo) return jsonResponse({ error: 'Votação não encontrada.' }, 404)
    if (votacao.modo !== 'qrcode') return jsonResponse({ error: 'Esta votação não está aberta para voto por link.' }, 403)

    const aberta = votacao.status === 'aberta' && (!votacao.data_fim || new Date(votacao.data_fim) > new Date())

    if (action === 'info') {
      const [{ data: opcoes }, { data: condo }, { data: unidades }] = await Promise.all([
        admin.from('votacao_opcoes').select('id, texto, ordem').eq('votacao_id', votacaoId).order('ordem'),
        admin.from('condominios').select('nome, logo_url').eq('id', votacao.condominio_id).maybeSingle(),
        admin.from('unidades').select('id, bloco, numero').eq('condominio_id', votacao.condominio_id).eq('ativo', true).order('numero'),
      ])
      return jsonResponse({
        ok: true,
        votacao: {
          id: votacao.id,
          titulo: votacao.titulo,
          descricao: votacao.descricao,
          aberta,
          status: votacao.status,
          data_fim: votacao.data_fim,
          requer_codigo: !!votacao.codigo_acesso,
        },
        condominio: { nome: condo?.nome ?? null, logo_url: condo?.logo_url ?? null },
        opcoes: (opcoes ?? []).map((o) => ({ id: o.id, texto: o.texto })),
        unidades: (unidades ?? []).map((u) => ({
          id: u.id,
          label: u.bloco ? `${u.bloco}-${u.numero}` : u.numero,
        })),
      })
    }

    if (action === 'votar') {
      if (!aberta) return jsonResponse({ error: 'Votação encerrada.' }, 400)
      const opcaoId: string = body.opcao_id
      const unidadeId: string = body.unidade_id
      const eleitorNome: string = (body.eleitor_nome ?? '').trim()
      const codigo: string = (body.codigo ?? '').trim()

      if (!opcaoId || !unidadeId) return jsonResponse({ error: 'Opção e unidade são obrigatórias.' }, 400)
      if (!eleitorNome) return jsonResponse({ error: 'Informe seu nome.' }, 400)
      if (votacao.codigo_acesso && codigo !== votacao.codigo_acesso) {
        return jsonResponse({ error: 'Código de acesso incorreto.' }, 400)
      }

      // Opção pertence à votação?
      const { data: opcao } = await admin
        .from('votacao_opcoes').select('id').eq('id', opcaoId).eq('votacao_id', votacaoId).maybeSingle()
      if (!opcao) return jsonResponse({ error: 'Opção inválida.' }, 400)

      // Unidade pertence ao condomínio?
      const { data: unidade } = await admin
        .from('unidades').select('id').eq('id', unidadeId).eq('condominio_id', votacao.condominio_id).maybeSingle()
      if (!unidade) return jsonResponse({ error: 'Unidade inválida.' }, 400)

      const { error: insErr } = await admin.from('votos').insert({
        votacao_id: votacaoId,
        opcao_id: opcaoId,
        user_id: null,
        unidade_id: unidadeId,
        eleitor_nome: eleitorNome,
        verificado: false,
      })
      if (insErr) {
        if ((insErr as { code?: string }).code === '23505') {
          return jsonResponse({ error: 'Esta unidade já registrou um voto nesta votação.' }, 409)
        }
        return jsonResponse({ error: insErr.message }, 500)
      }
      return jsonResponse({ ok: true })
    }

    if (action === 'cadastrar_votar') {
      if (!aberta) return jsonResponse({ error: 'Votação encerrada.' }, 400)
      const opcaoId: string = body.opcao_id
      const unidadeId: string = body.unidade_id
      const nome: string = (body.nome ?? '').trim()
      const email: string = (body.email ?? '').trim().toLowerCase()
      const senha: string = body.senha ?? ''
      const codigo: string = (body.codigo ?? '').trim()

      if (!opcaoId || !unidadeId) return jsonResponse({ error: 'Opção e unidade são obrigatórias.' }, 400)
      if (!nome) return jsonResponse({ error: 'Informe seu nome.' }, 400)
      if (!email) return jsonResponse({ error: 'Informe seu e-mail.' }, 400)
      if (senha.length < 8) return jsonResponse({ error: 'Senha precisa ter no mínimo 8 caracteres.' }, 400)
      if (votacao.codigo_acesso && codigo !== votacao.codigo_acesso) {
        return jsonResponse({ error: 'Código de acesso incorreto.' }, 400)
      }

      // Rate limit por IP (anti-abuso de criação de conta). Limite alto pra não
      // travar assembleia presencial (muitos cadastros pelo mesmo Wi-Fi do prédio).
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('cf-connecting-ip') ?? 'unknown'
      const { data: allowed } = await admin.rpc('check_rate_limit', {
        p_bucket: 'votacao_signup', p_identifier: ip, p_limit: 80, p_window_secs: 600,
      })
      if (allowed === false) return jsonResponse({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429)

      // Validações de opção/unidade + unidade ainda não votou
      const [{ data: opcao }, { data: unidade }, { data: jaVotou }] = await Promise.all([
        admin.from('votacao_opcoes').select('id').eq('id', opcaoId).eq('votacao_id', votacaoId).maybeSingle(),
        admin.from('unidades').select('id').eq('id', unidadeId).eq('condominio_id', votacao.condominio_id).maybeSingle(),
        admin.from('votos').select('id').eq('votacao_id', votacaoId).eq('unidade_id', unidadeId).maybeSingle(),
      ])
      if (!opcao) return jsonResponse({ error: 'Opção inválida.' }, 400)
      if (!unidade) return jsonResponse({ error: 'Unidade inválida.' }, 400)
      if (jaVotou) return jsonResponse({ error: 'Esta unidade já registrou um voto nesta votação.' }, 409)

      // Cria a conta (morador do condomínio, e-mail confirmado)
      const { data: created, error: uErr } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome },
      })
      if (uErr || !created?.user) {
        const msg = (uErr?.message ?? '').toLowerCase()
        const friendly = msg.includes('already') ? 'Esse e-mail já tem conta. Use "já tenho conta".' : (uErr?.message ?? 'Falha ao criar conta.')
        return jsonResponse({ error: friendly }, 400)
      }
      const userId = created.user.id

      const { error: pErr } = await admin.from('perfis').insert({
        id: userId, condominio_id: votacao.condominio_id, role: 'morador', nome_exibicao: nome,
      })
      if (pErr) {
        await admin.auth.admin.deleteUser(userId)
        return jsonResponse({ error: `Falha ao criar perfil: ${pErr.message}` }, 500)
      }

      await admin.from('pessoas').insert({
        condominio_id: votacao.condominio_id, user_id: userId, nome,
        tipo_vinculo: 'morador', unidade_id: unidadeId, email, ativo: true,
      })

      const { error: vErr } = await admin.from('votos').insert({
        votacao_id: votacaoId, opcao_id: opcaoId, user_id: userId,
        unidade_id: unidadeId, eleitor_nome: nome, verificado: true,
      })
      if (vErr) {
        // Corrida na unidade: desfaz a conta pra não deixar lixo.
        await admin.auth.admin.deleteUser(userId)
        if ((vErr as { code?: string }).code === '23505') {
          return jsonResponse({ error: 'Esta unidade já registrou um voto nesta votação.' }, 409)
        }
        return jsonResponse({ error: vErr.message }, 500)
      }

      // Sessão pro front logar direto
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data: session } = await userClient.auth.signInWithPassword({ email, password: senha })
      return jsonResponse({
        ok: true,
        session: session?.session
          ? { access_token: session.session.access_token, refresh_token: session.session.refresh_token }
          : null,
      })
    }

    return jsonResponse({ error: 'Ação inválida.' }, 400)
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
