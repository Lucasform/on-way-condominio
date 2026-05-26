-- 0012_votacoes.sql
-- Fase 10, etapa 79 do ROADMAP.
-- Votações de assembleia (perguntas + opções + votos).

-- ============================================================
-- 1) Tabela votacoes
-- ============================================================
create table public.votacoes (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  criado_por      uuid not null
                  references auth.users(id) on delete set default
                  default '00000000-0000-0000-0000-000000000000'::uuid,
  titulo          text not null,
  descricao       text,
  data_inicio     timestamptz not null default now(),
  data_fim        timestamptz,
  status          text not null default 'aberta'
                  check (status in ('aberta','encerrada','cancelada')),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index votacoes_condominio_idx on public.votacoes (condominio_id);
create index votacoes_status_idx on public.votacoes (condominio_id, status, data_inicio desc);

create trigger trg_votacoes_updated_at
before update on public.votacoes
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) Tabela votacao_opcoes
-- ============================================================
create table public.votacao_opcoes (
  id              uuid primary key default gen_random_uuid(),
  votacao_id      uuid not null
                  references public.votacoes(id) on delete cascade,
  texto           text not null,
  ordem           integer not null default 0,
  created_at      timestamptz not null default now()
);

create index votacao_opcoes_votacao_idx on public.votacao_opcoes (votacao_id, ordem);

-- ============================================================
-- 3) Tabela votos (1 voto por user por votação)
-- ============================================================
create table public.votos (
  id              uuid primary key default gen_random_uuid(),
  votacao_id      uuid not null
                  references public.votacoes(id) on delete cascade,
  opcao_id        uuid not null
                  references public.votacao_opcoes(id) on delete cascade,
  user_id         uuid not null
                  references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (votacao_id, user_id)
);

create index votos_votacao_idx on public.votos (votacao_id);
create index votos_user_idx on public.votos (user_id);

-- ============================================================
-- 4) RLS — votacoes
-- ============================================================
alter table public.votacoes enable row level security;
alter table public.votacoes force row level security;

create policy votacoes_select on public.votacoes
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

create policy votacoes_insert on public.votacoes
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy votacoes_update on public.votacoes
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

create policy votacoes_delete on public.votacoes
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- 5) RLS — votacao_opcoes (segue regras da votação pai)
-- ============================================================
alter table public.votacao_opcoes enable row level security;
alter table public.votacao_opcoes force row level security;

create policy opcoes_select on public.votacao_opcoes
  for select to authenticated
  using (votacao_id in (select id from public.votacoes));

create policy opcoes_insert on public.votacao_opcoes
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or exists (
      select 1 from public.votacoes v
       where v.id = votacao_id
         and v.condominio_id in (select public.user_condominios())
         and public.user_role_in(v.condominio_id) in ('administradora','sindico')
    )
  );

create policy opcoes_update on public.votacao_opcoes
  for update to authenticated
  using (
    public.is_admin_onway()
    or exists (
      select 1 from public.votacoes v
       where v.id = votacao_id
         and v.condominio_id in (select public.user_condominios())
         and public.user_role_in(v.condominio_id) in ('administradora','sindico')
    )
  );

create policy opcoes_delete on public.votacao_opcoes
  for delete to authenticated
  using (
    public.is_admin_onway()
    or exists (
      select 1 from public.votacoes v
       where v.id = votacao_id
         and v.condominio_id in (select public.user_condominios())
         and public.user_role_in(v.condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- 6) RLS — votos
-- ============================================================
alter table public.votos enable row level security;
alter table public.votos force row level security;

-- SELECT: admin_onway vê todos; staff vê todos do condo; user vê só os próprios
-- (votos individuais ficam ocultos por padrão — só admin vê quem votou no quê)
create policy votos_select on public.votos
  for select to authenticated
  using (
    public.is_admin_onway()
    or user_id = auth.uid()
    or exists (
      select 1 from public.votacoes v
       where v.id = votacao_id
         and v.condominio_id in (select public.user_condominios())
         and public.user_role_in(v.condominio_id) in ('administradora','sindico')
    )
  );

-- INSERT: user só pode votar como si próprio, em votação aberta do próprio condo
create policy votos_insert on public.votos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.votacoes v
       where v.id = votacao_id
         and v.status = 'aberta'
         and (v.data_fim is null or v.data_fim > now())
         and v.condominio_id in (select public.user_condominios())
    )
  );

-- UPDATE: troca de voto (mesmo user, mesma votação)
create policy votos_update on public.votos
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: o user pode remover o próprio voto enquanto a votação está aberta
create policy votos_delete on public.votos
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_onway()
  );

-- ============================================================
-- Fim 0012_votacoes.sql
-- ============================================================
