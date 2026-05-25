-- 0009_mural.sql
-- Fase 6, etapas 63-66 do ROADMAP.
-- Mural de publicações com reações simples.
-- Storage bucket `mural-imagens` (privado, mesma convenção de path do `ocorrencia-fotos`).

-- ============================================================
-- 1) Tabela publicacoes
-- ============================================================
create table public.publicacoes (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  autor_id        uuid not null
                  references auth.users(id) on delete set default
                  default '00000000-0000-0000-0000-000000000000'::uuid,
  titulo          text,
  conteudo        text not null,
  imagem_url      text,
  fixado          boolean not null default false,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index publicacoes_condominio_idx        on public.publicacoes (condominio_id);
create index publicacoes_condominio_ativo_idx  on public.publicacoes (condominio_id, ativo, fixado desc, created_at desc);
create index publicacoes_autor_idx             on public.publicacoes (autor_id);

create trigger trg_publicacoes_updated_at
before update on public.publicacoes
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) Tabela reacoes
-- ============================================================
create table public.reacoes (
  id              uuid primary key default gen_random_uuid(),
  publicacao_id   uuid not null
                  references public.publicacoes(id) on delete cascade,
  user_id         uuid not null
                  references auth.users(id) on delete cascade,
  tipo            text not null default 'curtir'
                  check (tipo in ('curtir','amei','aplaudir')),
  created_at      timestamptz not null default now(),
  unique (publicacao_id, user_id, tipo)
);

create index reacoes_publicacao_idx on public.reacoes (publicacao_id);
create index reacoes_user_idx       on public.reacoes (user_id);

-- ============================================================
-- 3) RLS publicacoes
-- ============================================================
alter table public.publicacoes enable row level security;
alter table public.publicacoes force row level security;

-- SELECT: admin_onway tudo; qualquer perfil do condomínio vê (mural é interno)
create policy publicacoes_select on public.publicacoes
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- INSERT: admin_onway + administradora + sindico (broadcast oficial)
create policy publicacoes_insert on public.publicacoes
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- UPDATE: admin_onway + autor + administradora/sindico do condomínio
create policy publicacoes_update on public.publicacoes
  for update to authenticated
  using (
    public.is_admin_onway()
    or autor_id = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  )
  with check (
    public.is_admin_onway()
    or autor_id = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- DELETE: admin_onway + administradora/sindico
create policy publicacoes_delete on public.publicacoes
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- 4) RLS reacoes
-- ============================================================
alter table public.reacoes enable row level security;
alter table public.reacoes force row level security;

-- SELECT: qualquer um que vê a publicação vê as reações
create policy reacoes_select on public.reacoes
  for select to authenticated
  using (
    publicacao_id in (
      select id from public.publicacoes
      -- A subquery será filtrada automaticamente pelas policies de publicacoes
    )
  );

-- INSERT: o user só pode reagir como si próprio (user_id = auth.uid())
-- e desde que veja a publicação (RLS de publicacoes barra acesso a outras)
create policy reacoes_insert on public.reacoes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and publicacao_id in (select id from public.publicacoes)
  );

-- DELETE: só a própria reação (toggle)
create policy reacoes_delete on public.reacoes
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_onway()
  );

-- ============================================================
-- 5) Storage bucket mural-imagens (privado, mesma convenção)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('mural-imagens', 'mural-imagens', false)
on conflict (id) do nothing;

-- SELECT: usuário vê imagens do próprio condomínio
create policy "mural_imagens_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mural-imagens'
    and public.storage_path_in_user_condominios(name)
  );

-- INSERT: admin/adm/sindico do condomínio (mesmas regras de criar post)
create policy "mural_imagens_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mural-imagens'
    and (
      public.is_admin_onway()
      or exists (
        select 1
          from public.perfis p
         where p.id = auth.uid()
           and p.ativo = true
           and p.role in ('administradora','sindico')
           and p.condominio_id is not null
           and starts_with(name, p.condominio_id::text || '/')
      )
    )
  );

-- UPDATE/DELETE: mesma regra do INSERT
create policy "mural_imagens_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'mural-imagens'
    and (
      public.is_admin_onway()
      or exists (
        select 1
          from public.perfis p
         where p.id = auth.uid()
           and p.ativo = true
           and p.role in ('administradora','sindico')
           and p.condominio_id is not null
           and starts_with(name, p.condominio_id::text || '/')
      )
    )
  );

create policy "mural_imagens_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mural-imagens'
    and (
      public.is_admin_onway()
      or exists (
        select 1
          from public.perfis p
         where p.id = auth.uid()
           and p.ativo = true
           and p.role in ('administradora','sindico')
           and p.condominio_id is not null
           and starts_with(name, p.condominio_id::text || '/')
      )
    )
  );

-- ============================================================
-- Fim 0009_mural.sql
-- ============================================================
