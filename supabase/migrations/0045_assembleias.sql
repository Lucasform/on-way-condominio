-- 0045_assembleias.sql
-- Tabela assembleias + bucket pra atas + ligacao opcional com votacoes.

-- ============================================================
-- 1) Tabela assembleias
-- ============================================================
create table public.assembleias (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  titulo          text not null,
  tipo            text not null default 'ordinaria'
                  check (tipo in ('ordinaria','extraordinaria')),
  data_assembleia timestamptz not null,
  local           text,
  status          text not null default 'planejada'
                  check (status in ('planejada','realizada','cancelada')),
  pauta           text,
  ata_url         text,
  ata_texto       text,
  observacoes     text,
  criado_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index assembleias_condominio_idx on public.assembleias (condominio_id);
create index assembleias_data_idx on public.assembleias (condominio_id, data_assembleia desc);

create trigger trg_assembleias_updated_at
before update on public.assembleias
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) Liga votacoes a uma assembleia (opcional)
-- ============================================================
alter table public.votacoes
  add column if not exists assembleia_id uuid
    references public.assembleias(id) on delete set null;

create index if not exists votacoes_assembleia_idx
  on public.votacoes (assembleia_id);

-- ============================================================
-- 3) RLS
-- ============================================================
alter table public.assembleias enable row level security;
alter table public.assembleias force row level security;

-- SELECT: admin_onway + qualquer membro do condominio
create policy assembleias_select on public.assembleias
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- INSERT: admin_onway, administradora, sindico (subsindico via user_role_in)
create policy assembleias_insert on public.assembleias
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy assembleias_update on public.assembleias
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

-- DELETE: admin_onway + sindico apenas
create policy assembleias_delete on public.assembleias
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) = 'sindico'
    )
  );

-- ============================================================
-- 4) Bucket privado pra atas em PDF
-- ============================================================
insert into storage.buckets (id, name, public)
values ('assembleia-atas','assembleia-atas', false)
on conflict (id) do nothing;

-- SELECT no bucket: membros do condominio dono da assembleia
drop policy if exists "assembleia_atas_select" on storage.objects;
create policy "assembleia_atas_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assembleia-atas'
    and (
      public.is_admin_onway()
      or (
        (storage.foldername(name))[1]::uuid in (select public.user_condominios())
      )
    )
  );

-- INSERT/UPDATE/DELETE: admin_onway, administradora, sindico
drop policy if exists "assembleia_atas_insert" on storage.objects;
create policy "assembleia_atas_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assembleia-atas'
    and (
      public.is_admin_onway()
      or (
        (storage.foldername(name))[1]::uuid in (select public.user_condominios())
        and public.user_role_in((storage.foldername(name))[1]::uuid)
            in ('administradora','sindico')
      )
    )
  );

drop policy if exists "assembleia_atas_update" on storage.objects;
create policy "assembleia_atas_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'assembleia-atas'
    and (
      public.is_admin_onway()
      or (
        (storage.foldername(name))[1]::uuid in (select public.user_condominios())
        and public.user_role_in((storage.foldername(name))[1]::uuid)
            in ('administradora','sindico')
      )
    )
  );

drop policy if exists "assembleia_atas_delete" on storage.objects;
create policy "assembleia_atas_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assembleia-atas'
    and (
      public.is_admin_onway()
      or (
        (storage.foldername(name))[1]::uuid in (select public.user_condominios())
        and public.user_role_in((storage.foldername(name))[1]::uuid) = 'sindico'
      )
    )
  );
