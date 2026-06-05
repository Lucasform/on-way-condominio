// supabase/functions/cron-pet-vacina-lembretes/index.ts
// Cron diario: pets cuja antirrabica vence em <= 30 dias recebem lembrete
// por e-mail pro dono (pessoa.email). Idempotente por dia+tipo.
//
// Agendamento (SQL, uma vez):
//   select cron.schedule(
//     'pet-vacina-diario',
//     '0 11 * * *',
//     $$ select net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/cron-pet-vacina-lembretes',
//          headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.settings.service_role_key'))
//        ) $$
//   );

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(url, serviceKey)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isoToday = today.toISOString().slice(0, 10)
    const in30days = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10)

    const { data: pets, error } = await sb
      .from('pets')
      .select('id, nome, condominio_id, pessoa_id, data_vacina_antirabica, unidade_id')
      .eq('ativo', true)
      .not('data_vacina_antirabica', 'is', null)
      .lte('data_vacina_antirabica', in30days)
    if (error) throw error

    let enviadas = 0

    for (const pet of pets ?? []) {
      const venc = pet.data_vacina_antirabica as string
      const tipo: 'antirabica_30d' | 'antirabica_vencida' = venc < isoToday ? 'antirabica_vencida' : 'antirabica_30d'

      // Idempotencia: enviou hoje?
      const { data: ja } = await sb
        .from('pet_vacina_lembretes_enviados')
        .select('id')
        .eq('pet_id', pet.id)
        .eq('tipo', tipo)
        .gte('enviado_em', today.toISOString())
        .maybeSingle()
      if (ja) continue

      // Acha o email do dono
      let email: string | null = null
      let donoNome: string | null = null
      if (pet.pessoa_id) {
        const { data: pe } = await sb
          .from('pessoas')
          .select('email, nome')
          .eq('id', pet.pessoa_id)
          .maybeSingle()
        email = (pe as { email: string | null } | null)?.email ?? null
        donoNome = (pe as { nome: string | null } | null)?.nome ?? null
      }
      // Fallback: qualquer morador ativo da unidade
      if (!email && pet.unidade_id) {
        const { data: pes } = await sb
          .from('pessoas')
          .select('email')
          .eq('unidade_id', pet.unidade_id)
          .eq('ativo', true)
          .not('email', 'is', null)
          .limit(1)
        email = (pes?.[0] as { email: string | null } | undefined)?.email ?? null
      }
      if (!email) continue

      const { data: condo } = await sb
        .from('condominios')
        .select('nome')
        .eq('id', pet.condominio_id)
        .maybeSingle()

      const subject = tipo === 'antirabica_vencida'
        ? `🐾 Vacina antirrábica de ${pet.nome} venceu`
        : `🐾 Vacina antirrábica de ${pet.nome} vence em ${diasAteVencimento(venc, today)} dia(s)`

      const corpo = `<p>Olá${donoNome ? `, ${escapeHtml(donoNome)}` : ''}.</p>
<p>A vacina antirrábica de <strong>${escapeHtml(pet.nome)}</strong> tem vencimento em <strong>${formatDate(venc)}</strong>.</p>
${tipo === 'antirabica_vencida'
  ? '<p>Por favor, regularize com o veterinário e atualize no app.</p>'
  : '<p>Vale agendar o reforço com o veterinário e depois atualizar a data no app.</p>'
}`

      const resp = await fetch(`${url}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          to: email,
          template: 'custom',
          condominio_id: pet.condominio_id,
          custom: { subject, html: corpo },
          vars: { condominio_nome: condo?.nome },
        }),
      })
      if (!resp.ok) continue

      // Alerta interno pro staff
      const { data: staff } = await sb
        .from('perfis').select('id')
        .eq('condominio_id', pet.condominio_id)
        .in('role', ['sindico', 'subsindico', 'administradora']).eq('ativo', true)
      const alertas = ((staff ?? []) as Array<{ id: string }>).map((s) => ({
        user_id: s.id, condominio_id: pet.condominio_id, tipo: 'pet_vacina',
        titulo: subject,
        conteudo: `${donoNome ? `Dono: ${donoNome}. ` : ''}Vence em ${formatDate(venc)}.`,
        link: '/pets',
      }))
      if (alertas.length > 0) await sb.from('app_notifications').insert(alertas)

      await sb.from('pet_vacina_lembretes_enviados').insert({ pet_id: pet.id, tipo })
      enviadas++
    }

    return jsonResponse({ ok: true, total: pets?.length ?? 0, enviadas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron-pet-vacina]', msg)
    return jsonResponse({ error: msg }, 500)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function diasAteVencimento(venc: string, today: Date): number {
  const v = new Date(venc + 'T00:00:00').getTime()
  const t = today.getTime()
  return Math.max(0, Math.round((v - t) / 86400_000))
}
