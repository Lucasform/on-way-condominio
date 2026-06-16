/**
 * stripe-webhook — Edge Function
 *
 * COMO ATIVAR (quando tiver conta Stripe):
 * 1. Adicionar secrets via `supabase secrets set`:
 *      STRIPE_SECRET_KEY=sk_live_...
 *      STRIPE_WEBHOOK_SECRET=whsec_...
 * 2. Deploy: `supabase functions deploy stripe-webhook`
 * 3. No painel Stripe → Webhooks → adicionar URL:
 *      https://<project>.supabase.co/functions/v1/stripe-webhook
 *    Eventos a escutar:
 *      checkout.session.completed
 *      customer.subscription.updated
 *      customer.subscription.deleted
 *      invoice.payment_failed
 *
 * MAPEAMENTO DE PRICE IDS (configurar após criar produtos no Stripe):
 *   STRIPE_PRICE_BASICO=price_...
 *   STRIPE_PRICE_PROFISSIONAL=price_...
 *   STRIPE_PRICE_ENTERPRISE=price_...
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PRICE_TO_PLANO: Record<string, { plano_id: string; features: string[]; limite_unidades: number | null; limite_staff: number | null; storage_gb: number | null }> = {
  // Preencher com os price IDs reais após criação no Stripe
  // [Deno.env.get('STRIPE_PRICE_BASICO') ?? '']: {
  //   plano_id: 'basico',
  //   features: ['portaria','acessos','moradores','mural','ocorrencias'],
  //   limite_unidades: 30, limite_staff: 2, storage_gb: 1,
  // },
  // [Deno.env.get('STRIPE_PRICE_PROFISSIONAL') ?? '']: {
  //   plano_id: 'profissional',
  //   features: ['portaria','acessos','moradores','mural','ocorrencias','chat','comunicados','classificados','multas','chamados','calendario'],
  //   limite_unidades: 150, limite_staff: 5, storage_gb: 10,
  // },
  // [Deno.env.get('STRIPE_PRICE_ENTERPRISE') ?? '']: {
  //   plano_id: 'enterprise',
  //   features: ['portaria','acessos','moradores','mural','ocorrencias','chat','comunicados','classificados','multas','chamados','calendario','assembleias','servicos','regimento','relatorios'],
  //   limite_unidades: null, limite_staff: null, storage_gb: 50,
  // },
}

Deno.serve(async (req) => {
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeSecret || !webhookSecret) {
    return new Response('Stripe não configurado.', { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Sem assinatura.', { status: 400 })

  const body = await req.text()

  // Verificar assinatura Stripe
  let event: Record<string, unknown>
  try {
    // Importação lazy para não exigir Stripe em DEV sem secrets
    const { Stripe } = await import('https://esm.sh/stripe@14?target=deno')
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-04-10' })
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

async function handleCheckoutCompleted(supabase: ReturnType<typeof createClient>, session: Record<string, unknown>) {
  const condominioId = (session.metadata as Record<string, string>)?.condominio_id
  if (!condominioId) throw new Error('condominio_id não encontrado em metadata')

  const priceId = (session.line_items as Record<string, unknown>)?.data?.[0]?.price?.id as string ?? ''
  const planoConfig = PRICE_TO_PLANO[priceId]
  if (!planoConfig) throw new Error(`Plano desconhecido para price_id: ${priceId}`)

  await supabase.from('assinaturas').update({
    plano_id: planoConfig.plano_id,
    status: 'ativo',
    features_plano: planoConfig.features,
    features_extras: [],
    limite_unidades: planoConfig.limite_unidades,
    limite_staff: planoConfig.limite_staff,
    storage_gb: planoConfig.storage_gb,
    periodo_inicio: new Date().toISOString(),
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
  }).eq('condominio_id', condominioId)
}

async function handleSubscriptionUpdated(supabase: ReturnType<typeof createClient>, subscription: Record<string, unknown>) {
  const customerId = subscription.customer as string
  const status = subscription.status as string

  const dbStatus = status === 'active' ? 'ativo'
    : status === 'past_due' ? 'inadimplente'
    : status === 'canceled' ? 'cancelado'
    : null

  if (!dbStatus) return

  await supabase.from('assinaturas').update({ status: dbStatus })
    .eq('stripe_customer_id', customerId)
}

async function handleSubscriptionDeleted(supabase: ReturnType<typeof createClient>, subscription: Record<string, unknown>) {
  const customerId = subscription.customer as string
  await supabase.from('assinaturas').update({ status: 'cancelado' })
    .eq('stripe_customer_id', customerId)
}

async function handlePaymentFailed(supabase: ReturnType<typeof createClient>, invoice: Record<string, unknown>) {
  const customerId = invoice.customer as string
  await supabase.from('assinaturas').update({ status: 'inadimplente' })
    .eq('stripe_customer_id', customerId)
}
