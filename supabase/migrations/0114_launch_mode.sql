-- Migration 0114: Modo lançamento
-- Quando ativo, todos os condos têm acesso total gratuito (bypass de assinatura).
-- Controlado por admin_onway via toggle no painel.

create table if not exists public.plataforma_config (
  key   text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.plataforma_config enable row level security;

create policy plataforma_config_read on public.plataforma_config
  for select to authenticated using (true);

create policy plataforma_config_write on public.plataforma_config
  for all to authenticated
  using (public.is_admin_onway())
  with check (public.is_admin_onway());

-- Seed: launch_mode ativo por padrão
insert into public.plataforma_config (key, valor)
values ('launch_mode', 'true'::jsonb)
on conflict (key) do nothing;
