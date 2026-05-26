-- 0020_audit_log.sql
-- Fase C: log de ações sensíveis para auditoria (B2B exige).
-- Quem fez o quê, em quem, quando, com que detalhes.

create table public.audit_log (
  id              bigserial primary key,
  ator_id         uuid references auth.users(id) on delete set null,
  ator_role       text,
  ator_email      text,
  condominio_id   uuid references public.condominios(id) on delete set null,
  acao            text not null,
  alvo_tipo       text,
  alvo_id         text,
  detalhes        jsonb not null default '{}'::jsonb,
  ip              text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index audit_log_ator_idx       on public.audit_log (ator_id, created_at desc);
create index audit_log_condo_idx      on public.audit_log (condominio_id, created_at desc);
create index audit_log_acao_idx       on public.audit_log (acao);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- SELECT: admin_onway tudo; sindico/administradora veem do próprio condo
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    public.is_admin_onway()
    or (condominio_id is not null
        and public.user_role_in(condominio_id) in ('administradora','sindico'))
  );

-- INSERT/UPDATE/DELETE somente service_role (Edges). Sem policy = bloqueado pra authenticated.
-- (service_role bypassa RLS, então as Edges gravam normalmente.)
