/**
 * create-checkout-session — cria uma sessão de checkout Stripe e retorna a URL.
 *
 * Secrets necessários (supabase secrets set):
 *   STRIPE_SECRET_KEY=sk_live_...   (ou sk_test_... para testar)
 *   STRIPE_PRICE_BASICO=price_...
 *   STRIPE_PRICE_PROFISSIONAL=price_...
 *   STRIPE_PRICE_ENTERPRISE=price_...
 */

import { corsHeaders } from '../_shared/cors.ts'
import { getCaller, HttpError } from '../_shared/auth.ts'

const PLANO_PRICE_ENV: Record<string, string> = {
  basico:        'STRIPE_PRICE_BASICO',
  profissional:  'STRIPE_PRICE_PROFISSIONAL',
  enterprise:    'STRIPE_PRICE_ENTERPRISE',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Pagamento online ainda não configurado. Entre em contato para ativar seu plano.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const caller = await getCaller(req)
    const condominioId = caller.perfil.condominio_id
    if (!condominioId) throw new HttpError('Perfil sem condomínio associado.', 400)

    const ROLES_PODEM_CONTRATAR = ['admin_onway', 'administradora', 'sindico']
    if (!ROLES_PODEM_CONTRATAR.includes(caller.perfil.role)) {
      throw new HttpError('Apenas síndico ou administradora pode contratar planos.', 403)
    }

    const { plano_id, success_url, cancel_url } = await req.json() as {
      plano_id: string
      success_url: string
      cancel_url: string
    }

    if (!plano_id || !success_url || !cancel_url) {
      throw new HttpError('plano_id, success_url e cancel_url são obrigatórios.', 400)
    }

    const envKey = PLANO_PRICE_ENV[plano_id]
    if (!envKey) throw new HttpError(`Plano desconhecido: ${plano_id}`, 400)

    const priceId = Deno.env.get(envKey)
    if (!priceId) throw new HttpError(`Price ID do plano "${plano_id}" não configurado.`, 503)

    // Buscar e-mail do usuário para pré-preencher no Stripe
    const { data: authUser } = await caller.admin.auth.admin.getUserById(caller.userId)
    const customerEmail = authUser?.user?.email ?? undefined

    // Importar Stripe
    const { Stripe } = await import('https://esm.sh/stripe@14?target=deno')
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: customerEmail,
      metadata: {
        condominio_id: condominioId,
        plano_id,
      },
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url,
      locale: 'pt-BR',
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { condominio_id: condominioId, plano_id },
        trial_period_days: 0,
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
