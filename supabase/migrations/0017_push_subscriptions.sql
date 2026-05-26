-- 0017_push_subscriptions.sql
-- Fase 9, etapa 78 do ROADMAP.
-- Tabela onde guardamos as subscriptions Web Push (PushSubscription do browser).
-- Quando o servidor quer enviar push pra um user, ele consulta as subscriptions ativas dele.

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null
                  references auth.users(id) on delete cascade,
  endpoint        text not null,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 1 subscription por user+endpoint (browser dele)
  unique (user_id, endpoint)
);

create index push_sub_user_idx on public.push_subscriptions (user_id) where ativo = true;
create index push_sub_endpoint_idx on public.push_subscriptions (endpoint);

create trigger trg_push_sub_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — cada user só gerencia as próprias
-- ============================================================
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

create policy push_sub_select on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_onway());

create policy push_sub_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy push_sub_update on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_sub_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_onway());

-- ============================================================
-- Fim 0017_push_subscriptions.sql
-- ============================================================
