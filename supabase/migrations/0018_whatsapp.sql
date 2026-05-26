-- 0018_whatsapp.sql
-- Backlog Fase 13 — Integração WhatsApp via provider não-oficial (Z-API, Evolution, etc).
-- Toda a estrutura instalada em modo DORMENTE: até admin configurar credenciais,
-- as funções de envio fazem skip silencioso.

-- ============================================================
-- 1) Tabela whatsapp_config (1 por condomínio)
-- ============================================================
create table public.whatsapp_config (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null unique
                  references public.condominios(id) on delete cascade,
  provider        text not null default 'z-api'
                  check (provider in ('z-api','evolution')),
  -- Z-API: https://api.z-api.io/instances/<instance>/token/<token>
  -- Evolution: URL da API
  api_url         text,
  instance_id     text,
  api_token       text,                -- token / client-token
  numero_envio    text,                -- número do WhatsApp do condo (só dígitos com DDI: 5511999999999)
  webhook_secret  text not null default replace(gen_random_uuid()::text, '-', ''),
  ativo           boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index whatsapp_config_condominio_idx on public.whatsapp_config (condominio_id);

create trigger trg_whatsapp_config_updated_at
before update on public.whatsapp_config
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) Adicionar canal na tabela conversas (default 'app')
-- ============================================================
alter table public.conversas
  add column if not exists canal text not null default 'app'
    check (canal in ('app','whatsapp')),
  add column if not exists wa_telefone text;  -- só preenchido se canal=whatsapp

create index if not exists conversas_canal_telefone_idx
  on public.conversas (canal, wa_telefone)
  where canal = 'whatsapp';

-- ============================================================
-- 3) RLS — whatsapp_config (só staff do condomínio)
-- ============================================================
alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_config force row level security;

create policy wa_config_select on public.whatsapp_config
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy wa_config_insert on public.whatsapp_config
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy wa_config_update on public.whatsapp_config
  for update to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  )
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy wa_config_delete on public.whatsapp_config
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- Fim 0018_whatsapp.sql
-- ============================================================
