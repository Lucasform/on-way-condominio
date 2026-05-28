-- =============================================================
-- Leva K: Regimento versionamento
-- =============================================================

create table if not exists regimento_versoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  versao_num int not null,
  motivo text,
  snapshot jsonb not null,                -- array de artigos no momento do snapshot
  total_artigos int not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (condominio_id, versao_num)
);

create index if not exists idx_regimento_versoes_condo
  on regimento_versoes (condominio_id, versao_num desc);

alter table regimento_versoes enable row level security;

drop policy if exists regimento_versoes_select on regimento_versoes;
create policy regimento_versoes_select on regimento_versoes for select
  using (
    condominio_id in (select condominio_id from perfis where user_id = auth.uid())
    or exists (select 1 from perfis p where p.user_id = auth.uid() and p.role = 'admin_onway')
  );

drop policy if exists regimento_versoes_insert on regimento_versoes;
create policy regimento_versoes_insert on regimento_versoes for insert
  with check (
    exists (
      select 1 from perfis p
      where p.user_id = auth.uid()
        and (
          p.role = 'admin_onway'
          or (p.role in ('administradora','sindico','subsindico') and p.condominio_id = regimento_versoes.condominio_id)
        )
    )
  );

-- Multa carrega referencia opcional pra versao do regimento vigente quando emitida
alter table multas
  add column if not exists regimento_versao_id uuid references regimento_versoes(id) on delete set null;

create index if not exists idx_multas_regimento_versao
  on multas (regimento_versao_id)
  where regimento_versao_id is not null;

-- Helper SQL: pega versao mais recente do condo
create or replace function regimento_versao_atual(p_condo uuid) returns uuid
language sql security definer set search_path = public
as $$
  select id from regimento_versoes
  where condominio_id = p_condo
  order by versao_num desc
  limit 1
$$;
