-- 0006_regimento.sql
-- Fase 3, etapa 36 do ROADMAP.
-- Cria a tabela `regimento_artigos` (artigos do regimento interno do condomínio).
-- Embedding (vetor pra busca semântica RAG) vem em 0007 com pgvector.

-- ============================================================
-- 1) Tabela regimento_artigos
-- ============================================================
create table public.regimento_artigos (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  numero          text,
  titulo          text not null,
  conteudo        text not null,
  -- Ordenação opcional pra controle do admin (caso `numero` seja inconsistente)
  ordem           integer not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index regimento_condominio_idx on public.regimento_artigos (condominio_id);
create index regimento_ativo_idx      on public.regimento_artigos (condominio_id, ativo);
create index regimento_ordem_idx      on public.regimento_artigos (condominio_id, ordem, numero);

create trigger trg_regimento_updated_at
before update on public.regimento_artigos
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) RLS
-- ============================================================
alter table public.regimento_artigos enable row level security;
alter table public.regimento_artigos force row level security;

-- SELECT:
--   admin_onway: vê todos
--   demais perfis: veem regimento do próprio condomínio
--   (regimento é "público" para os moradores do condomínio)
create policy regimento_select on public.regimento_artigos
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- INSERT/UPDATE/DELETE: admin_onway + administradora + sindico
create policy regimento_insert on public.regimento_artigos
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy regimento_update on public.regimento_artigos
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

create policy regimento_delete on public.regimento_artigos
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );
