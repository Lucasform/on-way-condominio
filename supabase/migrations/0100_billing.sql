-- 0100_billing.sql
-- Infraestrutura de billing: planos, assinaturas por condomínio, entitlements.
-- Stripe se plugará aqui via webhook: checkout.session.completed → atualiza assinatura.

-- ============================================================
-- Assinatura por condomínio
-- ============================================================
create table public.assinaturas (
  id                      uuid primary key default gen_random_uuid(),
  condominio_id           uuid not null unique references public.condominios(id) on delete cascade,

  -- Plano contratado ('basico' | 'profissional' | 'enterprise' | 'custom' | null=trial)
  plano_id                text,

  -- Status do ciclo
  status                  text not null default 'trial'
    check (status in ('trial', 'ativo', 'inadimplente', 'cancelado')),

  -- Features do plano + à la carte extras
  features_plano          text[] not null default '{}',
  features_extras         text[] not null default '{}',

  -- Limites do plano contratado (null = ilimitado)
  limite_unidades         int,
  limite_staff            int,
  storage_gb              int,

  -- Datas do ciclo
  trial_ends_at           timestamptz default (now() + interval '30 days'),
  periodo_inicio          timestamptz,
  periodo_fim             timestamptz,

  -- IDs Stripe (preenchidos pelo webhook quando Stripe estiver ativo)
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_price_id         text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.assinaturas is
  'Assinatura por condomínio. Durante trial todas as features ativas globalmente estão disponíveis. Após trial, só as features do plano + extras à la carte.';

create index assinaturas_condominio_idx on public.assinaturas(condominio_id);
create index assinaturas_stripe_customer_idx on public.assinaturas(stripe_customer_id) where stripe_customer_id is not null;

create or replace function public.set_assinaturas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_assinaturas_updated_at
  before update on public.assinaturas
  for each row execute procedure public.set_assinaturas_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.assinaturas enable row level security;

-- Admin OnWay lê tudo
create policy assinaturas_select_admin on public.assinaturas
  for select to authenticated
  using (exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway'));

-- Staff do próprio condomínio lê sua assinatura
create policy assinaturas_select_staff on public.assinaturas
  for select to authenticated
  using (
    condominio_id in (
      select condominio_id from public.perfis
       where id = auth.uid()
         and role in ('sindico','subsindico','administradora')
    )
  );

-- Apenas admin OnWay (ou service_role via webhook) pode escrever
create policy assinaturas_write_admin on public.assinaturas
  for all to authenticated
  using (exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway'))
  with check (exists (select 1 from public.perfis where id = auth.uid() and role = 'admin_onway'));

-- ============================================================
-- Seed: todos os condominios existentes entram em trial de 30 dias
-- ============================================================
insert into public.assinaturas (condominio_id, status, trial_ends_at)
select id, 'trial', now() + interval '30 days'
from public.condominios
on conflict (condominio_id) do nothing;

-- Trigger para criar assinatura trial automaticamente quando novo condo é criado
create or replace function public.criar_assinatura_trial()
returns trigger language plpgsql security definer as $$
begin
  insert into public.assinaturas (condominio_id, status, trial_ends_at)
  values (new.id, 'trial', now() + interval '30 days')
  on conflict do nothing;
  return new;
end;
$$;

create trigger trg_condo_criar_assinatura
  after insert on public.condominios
  for each row execute procedure public.criar_assinatura_trial();
