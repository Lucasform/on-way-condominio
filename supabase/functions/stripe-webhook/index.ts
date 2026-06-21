/**
 * stripe-webhook — processa eventos do Stripe e atualiza assinaturas.
 *
 * COMO ATIVAR:
 * 1. supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
 * 2. supabase functions deploy stripe-webhook
 * 3. Stripe → Webhooks → URL: https://<project>.supabase.co/functions/v1/stripe-webhook
 *    Eventos:
 *      checkout.session.completed
 *      customer.subscription.updated
 *      customer.subscription.deleted
 *      invoice.payment_failed
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Espelho de PLANO_CATALOG em src/types/billing.ts — manter em sync ao mudar planos
const PLANO_CONFIG: Record<string, {
  features: string[]
  limite_unidades: number | null
  limite_staff: number | null
  storage_gb: number | null
}> = {
  basico: {
    features: ['portaria', 'acessos', 'moradores', 'mural', 'ocorrencias'],
    limite_unidades: 30, limite_staff: 2, storage_gb: 1,
  },
  profissional: {
    features: ['portaria', 'acessos', 'moradores', 'mural', 'ocorrencias', 'chat', 'comunicados', 'classificados', 'multas', 'chamados', 'calendario'],
    limite_unidades: 150, limite_staff: 5, storage_gb: 10,
  },
  enterprise: {
    features: ['portaria', 'acessos', 'moradores', 'mural', 'ocorrencias', 'chat', 'comunicados', 'classificados', 'multas', 'chamados', 'calendario', 'assembleias', 'servicos', 'regimento', 'relatorios', 'whatsapp'],
    limite_unidades: null, limite_staff: null, storage_gb: 50,
  },
}

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeKey || !webhookSecret) {
    return new Response('Stripe não configurado.', { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Sem assinatura.', { status: 400 })

  const body = await req.text()

  let event: Record<string, unknown>
  try {
    const { Stripe } = await import('https://esm.sh/stripe@14?target=deno')
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as Record<string, unknown>
  } catch (err) {
    return new Response(`Assinatura inválida: ${err}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const eventType = event.type as string
  const data = (event.data as Record<string, unknown>)?.object as Record<string, unknown>

  try {
    if (eventType === 'checkout.session.completed') {
      await handleCheckoutCompleted(supabase, data)
    } else if (eventType === 'customer.subscription.updated') {
      await handleSubscriptionUpdated(supabase, data)
    } else if (eventType === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(supabase, data)
    } else if (eventType === 'invoice.payment_failed') {
      await handlePaymentFailed(supabase, data)
    }
  } catch (err) {
    console.error(`Erro ao processar ${eventType}:`, err)
    return new Response('Erro interno.', { status: 500 })
  }

  return new Response('ok', { status: 200 })
})

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Record<string, unknown>,
) {
  const meta = session.metadata as Record<string, string>
  const condominioId = meta?.condominio_id
  const planoId = meta?.plano_id

  if (!condominioId || !planoId) throw new Error('metadata.condominio_id ou plano_id ausente')

  const config = PLANO_CONFIG[planoId]
  if (!config) throw new Error(`Configuração não encontrada para plano: ${planoId}`)

  await supabase.from('assinaturas').update({
    plano_id: planoId,
    status: 'ativo',
    features_plano: config.features,
    features_extras: [],
    limite_unidades: config.limite_unidades,
    limite_staff: config.limite_staff,
    storage_gb: config.storage_gb,
    periodo_inicio: new Date().toISOString(),
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
  }).eq('condominio_id', condominioId)
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>,
) {
  const customerId = subscription.customer as string
  const status = subscription.status as string

  const dbStatus =
    status === 'active' ? 'ativo' :
    status === 'past_due' ? 'inadimplente' :
    status === 'canceled' ? 'cancelado' : null

  if (!dbStatus) return

  await supabase.from('assinaturas')
    .update({ status: dbStatus })
    .eq('stripe_customer_id', customerId)
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Record<string, unknown>,
) {
  const customerId = subscription.customer as string
  await supabase.from('assinaturas')
    .update({ status: 'cancelado' })
    .eq('stripe_customer_id', customerId)
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Record<string, unknown>,
) {
  const customerId = invoice.customer as string
  await supabase.from('assinaturas')
    .update({ status: 'inadimplente' })
    .eq('stripe_customer_id', customerId)
}
