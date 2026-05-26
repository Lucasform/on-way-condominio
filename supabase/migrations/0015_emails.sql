-- 0015_emails.sql
-- Fase 4, etapa 46 (parcial — sem templates table; templates ficam no código).
-- Tabela `emails` que serve simultaneamente como fila e como log de envios via Resend.

create table public.emails (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid
                  references public.condominios(id) on delete set null,
  para            text not null,
  assunto         text not null,
  html            text not null,
  texto           text,
  template_slug   text,  -- referência ao template usado (informativo)
  status          text not null default 'pending'
                  check (status in ('pending','sent','failed')),
  tentativas      integer not null default 0,
  resend_id       text,
  erro            text,
  agendado_para   timestamptz,
  enviado_por     uuid
                  references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index emails_condominio_idx on public.emails (condominio_id, created_at desc);
create index emails_status_idx on public.emails (status, agendado_para);
create index emails_enviado_por_idx on public.emails (enviado_por);

-- ============================================================
-- RLS
-- ============================================================
alter table public.emails enable row level security;
alter table public.emails force row level security;

-- SELECT: admin + staff (administradora/sindico) do condomínio
create policy emails_select on public.emails
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- INSERT: qualquer authenticated em condominio próprio (Edge Function valida quem manda)
create policy emails_insert on public.emails
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or condominio_id is null
    or condominio_id in (select public.user_condominios())
  );

-- UPDATE: só Edge Function via service_role (que ignora RLS)
-- (não criamos policy de UPDATE — bloqueia clients)

-- DELETE: só admin_onway
create policy emails_delete on public.emails
  for delete to authenticated
  using (public.is_admin_onway());
