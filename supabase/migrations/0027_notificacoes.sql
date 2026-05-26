-- 0027_notificacoes.sql
-- Notificacao formal (advertencia) = igual multa porem sem valor monetario.
-- Tipicamente eh emitida ANTES de uma multa, como aviso de descumprimento.

create table public.notificacoes (
  id                uuid primary key default gen_random_uuid(),
  condominio_id     uuid not null references public.condominios(id) on delete cascade,
  unidade_id        uuid not null references public.unidades(id) on delete restrict,
  pessoa_id         uuid references public.pessoas(id) on delete set null,
  ocorrencia_id     uuid references public.ocorrencias(id) on delete set null,
  emitida_por       uuid not null references auth.users(id) on delete restrict,

  assunto           text not null,
  descricao         text not null,
  artigo_regimento  text,
  observacoes       text,

  status            text not null default 'pendente'
                    check (status in ('pendente','enviada','ciente','arquivada','cancelada')),
  data_envio        timestamptz,
  data_ciencia      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index notificacoes_condo_idx     on public.notificacoes (condominio_id);
create index notificacoes_unidade_idx   on public.notificacoes (unidade_id);
create index notificacoes_status_idx    on public.notificacoes (status);
create index notificacoes_created_idx   on public.notificacoes (created_at desc);

create trigger trg_notificacoes_updated_at
  before update on public.notificacoes
  for each row execute function public.set_updated_at();

alter table public.notificacoes enable row level security;
alter table public.notificacoes force row level security;

-- SELECT: admin tudo; staff do condo veem do proprio condo; morador ve as proprias
create policy notificacoes_select on public.notificacoes
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- INSERT: admin/administradora/sindico
create policy notificacoes_insert on public.notificacoes
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) in ('administradora','sindico')
  );

create policy notificacoes_update on public.notificacoes
  for update to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) in ('administradora','sindico')
  )
  with check (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) in ('administradora','sindico')
  );

create policy notificacoes_delete on public.notificacoes
  for delete to authenticated
  using (public.is_admin_onway());
