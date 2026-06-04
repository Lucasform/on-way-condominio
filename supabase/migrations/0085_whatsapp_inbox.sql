-- 0085_whatsapp_inbox.sql
-- Inbox dedicado de WhatsApp, por telefone (independe de o contato ter login
-- no app). Guarda histórico permanente de entrada/saída por condomínio.

-- ============================================================
-- wa_conversas — uma por (condominio, telefone)
-- ============================================================
create table if not exists public.wa_conversas (
  id                  uuid primary key default gen_random_uuid(),
  condominio_id       uuid not null references public.condominios(id) on delete cascade,
  telefone            text not null,                 -- só dígitos, com DDI (5511...)
  contato_nome        text,                          -- nome resolvido (pessoa ou pushName)
  pessoa_id           uuid references public.pessoas(id) on delete set null,
  unidade_id          uuid references public.unidades(id) on delete set null,
  ultima_mensagem     text,
  ultima_mensagem_at  timestamptz,
  nao_lidas           int not null default 0,
  arquivada           boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (condominio_id, telefone)
);
create index if not exists wa_conversas_lista_idx
  on public.wa_conversas (condominio_id, arquivada, ultima_mensagem_at desc);

-- ============================================================
-- wa_mensagens — histórico
-- ============================================================
create table if not exists public.wa_mensagens (
  id              uuid primary key default gen_random_uuid(),
  wa_conversa_id  uuid not null references public.wa_conversas(id) on delete cascade,
  condominio_id   uuid not null references public.condominios(id) on delete cascade,
  direcao         text not null check (direcao in ('in','out')),
  conteudo        text not null,
  autor_id        uuid references auth.users(id) on delete set null,  -- staff que enviou (out)
  wa_message_id   text,
  created_at      timestamptz not null default now()
);
create index if not exists wa_mensagens_conversa_idx
  on public.wa_mensagens (wa_conversa_id, created_at);

-- ============================================================
-- RLS — staff do condomínio (mesma regra de whatsapp_config)
-- ============================================================
alter table public.wa_conversas enable row level security;
alter table public.wa_conversas force row level security;
alter table public.wa_mensagens enable row level security;
alter table public.wa_mensagens force row level security;

-- helper de escopo inline (admin geral OU staff do condo)
-- wa_conversas
create policy wa_conv_select on public.wa_conversas for select
  using (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')));
create policy wa_conv_insert on public.wa_conversas for insert
  with check (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')));
create policy wa_conv_update on public.wa_conversas for update
  using (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')))
  with check (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')));
create policy wa_conv_delete on public.wa_conversas for delete
  using (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')));

-- wa_mensagens
create policy wa_msg_select on public.wa_mensagens for select
  using (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')));
create policy wa_msg_insert on public.wa_mensagens for insert
  with check (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')));
create policy wa_msg_delete on public.wa_mensagens for delete
  using (public.is_admin_onway() or (condominio_id in (select public.user_condominios())
         and public.user_role_in(condominio_id) in ('administradora','sindico')));

-- ============================================================
-- Templates de WhatsApp: libera tipo 'whatsapp'
-- ============================================================
alter table public.mensagem_templates drop constraint if exists mensagem_templates_tipo_check;
alter table public.mensagem_templates
  add constraint mensagem_templates_tipo_check check (tipo in ('chat','email','whatsapp'));
