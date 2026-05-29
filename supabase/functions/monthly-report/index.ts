// supabase/functions/monthly-report/index.ts
// Resumo executivo mensal por IA. Roda 1x/mes via pg_cron.
// Pra cada condominio ativo, calcula KPIs do mes anterior, chama Haiku pra
// gerar resumo textual com pontos de atencao, envia email pros sindicos.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/cors.ts'

const MODEL = 'claude-haiku-4-5-20251001'

interface KPIs {
  ocorrencias_total: number
  ocorrencias_abertas: number
  multas_aplicadas: number
  multas_valor_total: number
  chamados_resolvidos: number
  chamados_pendentes: number
  emails_enviados: number
  publicacoes_mural: number
  top_categoria_chamado: string | null
  top_local_ocorrencia: string | null
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!anthropicKey || !resendKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY ou RESEND_API_KEY ausente.' }, 500)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Calcula mes anterior (ano-mes)
    const now = new Date()
    const mesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const ano = mesAnt.getFullYear()
    const mes = mesAnt.getMonth() + 1
    const anoMes = `${ano}-${String(mes).padStart(2, '0')}`
    const inicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString()
    const fim = new Date(Date.UTC(ano, mes, 1)).toISOString()
    const mesLabel = mesAnt.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

    // Lista condos ativos
    const { data: condos } = await admin
      .from('condominios')
      .select('id, nome')
      .eq('ativo', true)

    const resultados: Array<{ condo: string; status: string; motivo?: string }> = []

    for (const condo of (condos ?? []) as Array<{ id: string; nome: string }>) {
      try {
        // Idempotencia: ja enviado?
        const { data: jaEnviado } = await admin
          .from('monthly_reports_enviados')
          .select('ano_mes')
          .eq('condominio_id', condo.id)
          .eq('ano_mes', anoMes)
          .maybeSingle()
        if (jaEnviado) {
          resultados.push({ condo: condo.nome, status: 'ja_enviado' })
          continue
        }

        const kpis = await calcularKpis(admin, condo.id, inicio, fim)

        // Resumo textual via Haiku
        const resumoIA = await gerarResumo(anthropicKey, condo.nome, mesLabel, kpis)

        // Destinatarios: sindico, administradora, subsindico ativos
        const { data: destinatarios } = await admin
          .from('perfis')
          .select('id, nome_exibicao')
          .eq('condominio_id', condo.id)
          .in('role', ['sindico', 'subsindico', 'administradora'])
        const userIds = (destinatarios ?? []).map((p: { id: string }) => p.id)
        if (userIds.length === 0) {
          resultados.push({ condo: condo.nome, status: 'sem_destinatario' })
          continue
        }

        // Pega emails via auth.users (lookup pelo service role)
        const emails: string[] = []
        for (const uid of userIds) {
          const { data: u } = await admin.auth.admin.getUserById(uid)
          const e = u.user?.email
          if (e) emails.push(e)
        }
        if (emails.length === 0) {
          resultados.push({ condo: condo.nome, status: 'sem_email' })
          continue
        }

        // Monta HTML simples
        const html = montarHtml(condo.nome, mesLabel, kpis, resumoIA)

        // Envia via Resend
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `OnWay <nao-responda@onwaytech.com.br>`,
            to: emails,
            subject: `📊 Resumo executivo · ${condo.nome} · ${mesLabel}`,
            html,
          }),
        })
        if (!r.ok) {
          const txt = await r.text()
          resultados.push({ condo: condo.nome, status: 'falha_email', motivo: txt.slice(0, 200) })
          continue
        }

        await admin.from('monthly_reports_enviados').insert({
          condominio_id: condo.id,
          ano_mes: anoMes,
          destinatarios: emails.length,
        })
        resultados.push({ condo: condo.nome, status: 'enviado' })
      } catch (e) {
        resultados.push({
          condo: condo.nome,
          status: 'erro',
          motivo: e instanceof Error ? e.message : 'erro',
        })
      }
    }

    return jsonResponse({ ano_mes: anoMes, resultados })
  } catch (e) {
    console.error('[monthly-report] erro geral:', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro.' }, 500)
  }
})

async function calcularKpis(
  admin: ReturnType<typeof createClient>,
  cid: string,
  inicio: string,
  fim: string,
): Promise<KPIs> {
  const [
    { data: ocorrs },
    { data: multas },
    { data: chams },
    { data: emails },
    { data: pubs },
  ] = await Promise.all([
    admin.from('ocorrencias').select('status, local').eq('condominio_id', cid).gte('created_at', inicio).lt('created_at', fim),
    admin.from('multas').select('status, valor').eq('condominio_id', cid).gte('created_at', inicio).lt('created_at', fim),
    admin.from('chamados').select('status, categoria').eq('condominio_id', cid).gte('created_at', inicio).lt('created_at', fim),
    admin.from('emails').select('id').eq('condominio_id', cid).gte('created_at', inicio).lt('created_at', fim),
    admin.from('publicacoes').select('id').eq('condominio_id', cid).gte('created_at', inicio).lt('created_at', fim),
  ])

  const ocorrencias_total = (ocorrs ?? []).length
  const ocorrencias_abertas = (ocorrs ?? []).filter((o: any) => ['aberta', 'em_analise'].includes(o.status)).length
  const multas_aplicadas = (multas ?? []).filter((m: any) => ['aplicada', 'contestada', 'paga'].includes(m.status)).length
  const multas_valor_total = (multas ?? []).reduce((s: number, m: any) => s + (Number(m.valor) || 0), 0)
  const chamados_resolvidos = (chams ?? []).filter((c: any) => ['resolvido', 'finalizado'].includes(c.status)).length
  const chamados_pendentes = (chams ?? []).filter((c: any) => !['resolvido', 'finalizado', 'cancelado'].includes(c.status)).length
  const emails_enviados = (emails ?? []).length
  const publicacoes_mural = (pubs ?? []).length

  const catCount: Record<string, number> = {}
  for (const c of (chams ?? [])) catCount[c.categoria] = (catCount[c.categoria] ?? 0) + 1
  const top_categoria_chamado = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const locCount: Record<string, number> = {}
  for (const o of (ocorrs ?? [])) {
    if (o.local) locCount[o.local] = (locCount[o.local] ?? 0) + 1
  }
  const top_local_ocorrencia = Object.entries(locCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    ocorrencias_total,
    ocorrencias_abertas,
    multas_aplicadas,
    multas_valor_total,
    chamados_resolvidos,
    chamados_pendentes,
    emails_enviados,
    publicacoes_mural,
    top_categoria_chamado,
    top_local_ocorrencia,
  }
}

async function gerarResumo(
  anthropicKey: string,
  condoNome: string,
  mesLabel: string,
  kpis: KPIs,
): Promise<string> {
  const system = `Voce e um analista que escreve resumos executivos curtos para sindicos.
Estilo: portugues brasileiro, claro, 3 paragrafos de no maximo 3 linhas cada.
Nao use travessao (—) no meio da frase. Sem markdown. Sem invencao de dados.
Estrutura: 1) numeros principais do mes; 2) pontos de atencao; 3) recomendacao curta.`

  const userPrompt = `Condominio: ${condoNome}
Periodo: ${mesLabel}

KPIs:
- Ocorrencias registradas: ${kpis.ocorrencias_total} (${kpis.ocorrencias_abertas} ainda em aberto)
- Multas aplicadas: ${kpis.multas_aplicadas} (R$ ${kpis.multas_valor_total.toFixed(2).replace('.', ',')} no total)
- Chamados resolvidos: ${kpis.chamados_resolvidos} (${kpis.chamados_pendentes} pendentes)
- E-mails enviados: ${kpis.emails_enviados}
- Publicacoes no mural: ${kpis.publicacoes_mural}
- Categoria mais frequente em chamados: ${kpis.top_categoria_chamado ?? 'sem dados'}
- Local mais frequente em ocorrencias: ${kpis.top_local_ocorrencia ?? 'sem dados'}

Escreva o resumo executivo.`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!resp.ok) {
    const txt = await resp.text()
    console.error('[monthly] Claude error', resp.status, txt)
    return ''
  }
  const data = await resp.json()
  return data?.content?.[0]?.text ?? ''
}

function montarHtml(condoNome: string, mesLabel: string, kpis: KPIs, resumoIA: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const valor = `R$ ${kpis.multas_valor_total.toFixed(2).replace('.', ',')}`
  const resumoHtml = resumoIA
    ? esc(resumoIA).split('\n').filter(Boolean).map((p) => `<p style="margin:0 0 12px 0;">${p}</p>`).join('')
    : '<p style="margin:0 0 12px 0; color:#64748b; font-style:italic;">Resumo automatico nao disponivel.</p>'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, system-ui, sans-serif; background:#f1f5f9; padding:24px 0; margin:0;">
  <div style="max-width:640px; margin:0 auto; background:white; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#1D4ED8; color:white; padding:20px 24px;">
      <div style="font-size:12px; opacity:0.85; text-transform:uppercase; letter-spacing:0.05em;">Resumo executivo</div>
      <div style="font-size:18px; font-weight:600; margin-top:4px;">${esc(condoNome)}</div>
      <div style="font-size:14px; opacity:0.85; margin-top:2px;">${esc(mesLabel)}</div>
    </div>
    <div style="padding:24px;">
      <h2 style="font-size:14px; color:#64748b; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.05em;">Numeros do mes</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <tr>
          <td style="padding:8px 0; color:#475569;">Ocorrencias</td>
          <td style="padding:8px 0; text-align:right; font-weight:600;">${kpis.ocorrencias_total} <span style="color:#94a3b8;">(${kpis.ocorrencias_abertas} abertas)</span></td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#475569;">Multas aplicadas</td>
          <td style="padding:8px 0; text-align:right; font-weight:600;">${kpis.multas_aplicadas} <span style="color:#94a3b8;">(${esc(valor)})</span></td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#475569;">Chamados resolvidos</td>
          <td style="padding:8px 0; text-align:right; font-weight:600;">${kpis.chamados_resolvidos} <span style="color:#94a3b8;">(${kpis.chamados_pendentes} pendentes)</span></td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#475569;">E-mails enviados</td>
          <td style="padding:8px 0; text-align:right; font-weight:600;">${kpis.emails_enviados}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#475569;">Publicacoes no mural</td>
          <td style="padding:8px 0; text-align:right; font-weight:600;">${kpis.publicacoes_mural}</td>
        </tr>
      </table>

      <h2 style="font-size:14px; color:#64748b; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.05em;">Analise</h2>
      <div style="color:#1e293b; line-height:1.6;">
        ${resumoHtml}
      </div>
    </div>
    <div style="padding:16px 24px; background:#f8fafc; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:12px; text-align:center;">
      OnWay Condominio · Nao responda este e-mail.
    </div>
  </div>
</body>
</html>`
}
