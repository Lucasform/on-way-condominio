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

    return jsonResponse({ error: 'Ação inválida.' }, 400)
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
