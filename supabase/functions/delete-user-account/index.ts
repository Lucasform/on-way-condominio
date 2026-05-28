// Exclui um usuario completamente (auth.users + perfis em cascata) e envia
// e-mail avisando. So admin geral, sindico ou subsindico podem chamar.
//
// Body: { user_id: uuid, motivo?: string }

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getCaller, HttpError } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const caller = await getCaller(req)
    const role = caller.perfil.role
    if (!['admin_onway', 'sindico', 'subsindico'].includes(role)) {
      throw new HttpError('Apenas admin geral, síndico ou subsíndico podem excluir usuários.', 403)
    }

    const body = await req.json()
    const user_id: string | undefined = body?.user_id
    const motivo: string = String(body?.motivo ?? '').trim()
    if (!user_id) return jsonResponse({ error: 'user_id obrigatório.' }, 400)
    if (user_id === caller.userId) return jsonResponse({ error: 'Você não pode excluir a si mesmo.' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Pega dados do user pra usar no e-mail antes de apagar
    const { data: alvo } = await admin
      .from('perfis')
      .select('id, condominio_id, role, nome_exibicao')
      .eq('id', user_id)
      .maybeSingle()
    if (!alvo) return jsonResponse({ error: 'Perfil não encontrado.' }, 404)

    // Sindico/subsindico só podem excluir gente do próprio condo (e nunca admin_onway)
    if (role !== 'admin_onway') {
      if (alvo.role === 'admin_onway') {
        throw new HttpError('Apenas o admin geral pode excluir outro admin.', 403)
      }
      if (alvo.condominio_id !== caller.perfil.condominio_id) {
        throw new HttpError('Sem acesso a esse usuário (condomínio diferente).', 403)
      }
    }

    const { data: { user: alvoAuth } } = await admin.auth.admin.getUserById(user_id)
    const emailAlvo = alvoAuth?.email ?? null
    const nomeAlvo = alvo.nome_exibicao ?? emailAlvo ?? 'Usuário'

    // Pega nome do condomínio pra mensagem
    let condoNome: string | null = null
    if (alvo.condominio_id) {
      const { data: condo } = await admin
        .from('condominios')
        .select('nome')
        .eq('id', alvo.condominio_id)
        .maybeSingle()
      condoNome = condo?.nome ?? null
    }

    // Apaga auth.users → cascata em perfis + pessoas (pessoas.user_id ON DELETE SET NULL)
    const { error: delErr } = await admin.auth.admin.deleteUser(user_id)
    if (delErr) throw new HttpError(`Falha ao excluir usuário: ${delErr.message}`, 500)

    // Audit log
    try {
      await admin.from('audit_log').insert({
        ator_id: caller.userId,
        ator_role: caller.perfil.role,
        condominio_id: alvo.condominio_id,
        acao: 'usuario.excluido',
        alvo_tipo: 'user',
        alvo_id: user_id,
        detalhes: { nome: nomeAlvo, email: emailAlvo, motivo: motivo || null },
      })
    } catch (e) { console.warn('[delete-user] audit falhou:', e) }

    // Envia e-mail de aviso (não bloqueante)
    if (emailAlvo) {
      try {
        await caller.admin.functions.invoke('send-email', {
          body: {
            to: [emailAlvo],
            template: 'custom',
            condominio_id: alvo.condominio_id,
            custom: {
              subject: `Sua conta foi removida${condoNome ? ` — ${condoNome}` : ''}`,
              html: `
                <p>Olá, ${escapeHtml(nomeAlvo)}.</p>
                <p>Informamos que sua conta no OnWay Condomínio foi removida pela administração${condoNome ? ` do condomínio <strong>${escapeHtml(condoNome)}</strong>` : ''}.</p>
                <p>A partir deste momento você não terá mais acesso ao app.</p>
                ${motivo ? `<p><strong>Motivo informado:</strong> ${escapeHtml(motivo)}</p>` : ''}
                <p>Se você acredita que isso é um engano, entre em contato com a administração do condomínio.</p>
              `,
              text: `Sua conta no OnWay Condomínio foi removida pela administração${condoNome ? ` do condomínio ${condoNome}` : ''}. A partir deste momento você não terá mais acesso ao app.${motivo ? `\n\nMotivo informado: ${motivo}` : ''}\n\nSe acredita que é um engano, entre em contato com a administração.`,
            },
          },
        })
      } catch (e) {
        console.warn('[delete-user] e-mail falhou:', e)
      }
    }

    return jsonResponse({
      ok: true,
      user_id,
      email_enviado: !!emailAlvo,
    })
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse({ error: e.message }, e.status)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}
