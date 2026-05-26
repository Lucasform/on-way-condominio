-- 0011_app_notifications.sql
-- Fase 8, etapas 71, 72, 75 do ROADMAP.
-- Notificações in-app (sininho), com Realtime via Supabase.
-- Cada notificação é DESTINADA a um user específico (fan-out na criação).

-- ============================================================
-- 1) Tabela app_notifications
-- ============================================================
create table public.app_notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null
                  references auth.users(id) on delete cascade,
  condominio_id   uuid
                  references public.condominios(id) on delete cascade,
  tipo            text not null
                  check (tipo in
                    ('ocorrencia','multa','encomenda','mural','evento','sistema')),
  titulo          text not null,
  conteudo        text,
  link            text,           -- rota interna pra navegar
  lida            boolean not null default false,
  lida_em         timestamptz,
  created_at      timestamptz not null default now()
);

create index app_notifications_user_idx          on public.app_notifications (user_id, lida, created_at desc);
create index app_notifications_user_unread_idx   on public.app_notifications (user_id) where lida = false;
create index app_notifications_created_idx       on public.app_notifications (created_at desc);

-- ============================================================
-- 2) RLS — cada user só vê / mexe nas suas
-- ============================================================
alter table public.app_notifications enable row level security;
alter table public.app_notifications force row level security;

create policy app_notif_select on public.app_notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_onway());

-- Update apenas pra marcar como lida (cliente edita lida/lida_em)
create policy app_notif_update on public.app_notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts em geral vêm de triggers (security definer), mas o user pode
-- também criar pra si próprio se algum dia precisar (idempotente).
create policy app_notif_insert on public.app_notifications
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin_onway());

create policy app_notif_delete on public.app_notifications
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_onway());

-- ============================================================
-- 3) Realtime: habilitar a tabela
-- ============================================================
alter publication supabase_realtime add table public.app_notifications;

-- ============================================================
-- 4) Função helper: fan-out de notificação pra todos os perfis ativos
--    de um condomínio que casem com uma lista de roles.
-- ============================================================
create or replace function public.fanout_app_notification(
  p_condominio_id uuid,
  p_roles text[],
  p_tipo text,
  p_titulo text,
  p_conteudo text,
  p_link text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.app_notifications
    (user_id, condominio_id, tipo, titulo, conteudo, link)
  select p.id, p_condominio_id, p_tipo, p_titulo, p_conteudo, p_link
    from public.perfis p
   where p.condominio_id = p_condominio_id
     and p.ativo = true
     and (p_roles is null or p.role = any(p_roles));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- 5) Trigger: nova publicação no mural -> notifica TODOS do condomínio
-- ============================================================
create or replace function public.tg_mural_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fanout_app_notification(
    new.condominio_id,
    null,  -- todos os roles
    'mural',
    coalesce(new.titulo, 'Nova publicação no mural'),
    left(new.conteudo, 200),
    '/mural'
  );
  return new;
end;
$$;

create trigger trg_publicacoes_notify
after insert on public.publicacoes
for each row execute function public.tg_mural_notify();

-- ============================================================
-- 6) Trigger: nova ocorrência -> notifica staff (sindico/administradora)
-- ============================================================
create or replace function public.tg_ocorrencia_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fanout_app_notification(
    new.condominio_id,
    array['administradora','sindico'],
    'ocorrencia',
    'Nova ocorrência registrada',
    left(new.descricao, 200),
    '/ocorrencias/' || new.id::text
  );
  return new;
end;
$$;

create trigger trg_ocorrencias_notify
after insert on public.ocorrencias
for each row execute function public.tg_ocorrencia_notify();

-- ============================================================
-- 7) Trigger: nova multa -> notifica o morador (se houver pessoa vinculada)
-- ============================================================
create or replace function public.tg_multa_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if new.pessoa_id is not null then
    select user_id into v_user_id
      from public.pessoas where id = new.pessoa_id;
    if v_user_id is not null then
      insert into public.app_notifications
        (user_id, condominio_id, tipo, titulo, conteudo, link)
      values
        (v_user_id, new.condominio_id, 'multa',
         'Multa registrada para você',
         'R$ ' || to_char(new.valor, 'FM999G999G990D00') || ' — ' || left(new.descricao, 150),
         '/multas/' || new.id::text);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_multas_notify
after insert on public.multas
for each row execute function public.tg_multa_notify();

-- ============================================================
-- 8) Trigger: nova encomenda -> notifica destinatário (se houver) +
--    moradores da unidade (broadcast pra unidade)
-- ============================================================
create or replace function public.tg_encomenda_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_link text;
begin
  v_titulo := case new.tipo
    when 'comida' then '🍔 Sua comida chegou'
    when 'documento' then '📄 Documento na portaria'
    else '📦 Encomenda chegou'
  end;
  v_link := '/encomendas/' || new.id::text;

  -- Notifica todos os moradores ativos da unidade destinatária
  insert into public.app_notifications
    (user_id, condominio_id, tipo, titulo, conteudo, link)
  select p.user_id, new.condominio_id, 'encomenda',
         v_titulo,
         coalesce(new.descricao, 'Retire na portaria.'),
         v_link
    from public.pessoas p
   where p.unidade_id = new.unidade_id
     and p.user_id is not null
     and p.ativo = true;

  return new;
end;
$$;

create trigger trg_encomendas_notify
after insert on public.encomendas
for each row execute function public.tg_encomenda_notify();

-- ============================================================
-- Fim 0011_app_notifications.sql
-- ============================================================
