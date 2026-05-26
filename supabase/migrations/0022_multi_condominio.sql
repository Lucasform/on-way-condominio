-- 0022_multi_condominio.sql
-- Suporte a usuário ter acesso a múltiplos condomínios.
-- Estratégia: tabela junção `perfis_condominios` mantém a lista completa.
-- `perfis.condominio_id` continua sendo o "condomínio ativo" (default na sessão).
-- Helpers de RLS passam a consultar a junção.

create table public.perfis_condominios (
  perfil_id       uuid not null references public.perfis(id) on delete cascade,
  condominio_id   uuid not null references public.condominios(id) on delete cascade,
  role            text not null check (role in
                    ('administradora','sindico','portaria','ronda','morador')),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (perfil_id, condominio_id)
);

create index perfis_condominios_user_idx  on public.perfis_condominios (perfil_id) where ativo;
create index perfis_condominios_condo_idx on public.perfis_condominios (condominio_id) where ativo;

alter table public.perfis_condominios enable row level security;
alter table public.perfis_condominios force row level security;

-- SELECT: admin_onway tudo; user vê suas próprias linhas; staff vê do condo dele
create policy pc_select on public.perfis_condominios
  for select to authenticated
  using (
    public.is_admin_onway()
    or perfil_id = auth.uid()
    or public.user_is_staff_in(condominio_id)
  );

-- INSERT: admin_onway ou staff do condo (pra adicionar alguém ao seu prédio)
create policy pc_insert on public.perfis_condominios
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or public.user_is_staff_in(condominio_id)
  );

create policy pc_update on public.perfis_condominios
  for update to authenticated
  using (
    public.is_admin_onway()
    or public.user_is_staff_in(condominio_id)
  )
  with check (
    public.is_admin_onway()
    or public.user_is_staff_in(condominio_id)
  );

create policy pc_delete on public.perfis_condominios
  for delete to authenticated
  using (public.is_admin_onway() or public.user_is_staff_in(condominio_id));

-- ============================================================
-- Backfill: copia perfis.condominio_id atual pra junção
-- ============================================================
insert into public.perfis_condominios (perfil_id, condominio_id, role, ativo)
select id, condominio_id, role, ativo
  from public.perfis
 where condominio_id is not null
 on conflict do nothing;

-- ============================================================
-- Atualiza helpers pra usar a junção (mantém retrocompat)
-- ============================================================
create or replace function public.user_condominios()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select condominio_id
    from public.perfis_condominios
   where perfil_id = auth.uid()
     and ativo = true;
$$;

create or replace function public.user_role_in(p_condominio uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  -- admin_onway tem precedência sobre qualquer role específico
  select role from (
    select 'admin_onway' as role, 0 as ord
      from public.perfis
     where id = auth.uid() and role = 'admin_onway' and ativo = true
    union all
    select pc.role, 1
      from public.perfis_condominios pc
     where pc.perfil_id = auth.uid()
       and pc.condominio_id = p_condominio
       and pc.ativo = true
  ) t
  order by ord
  limit 1;
$$;

create or replace function public.user_is_staff_in(p_condominio uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis_condominios
     where perfil_id = auth.uid()
       and ativo = true
       and condominio_id = p_condominio
       and role in ('administradora','sindico')
  );
$$;

grant execute on function public.user_condominios() to authenticated;
grant execute on function public.user_role_in(uuid) to authenticated;
grant execute on function public.user_is_staff_in(uuid) to authenticated;

-- ============================================================
-- RPC pra trocar de condomínio (atualiza perfis.condominio_id se válido)
-- ============================================================
create or replace function public.set_active_condominio(p_condominio uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Valida que o user tem acesso a esse condomínio
  select role into v_role
    from public.perfis_condominios
   where perfil_id = auth.uid()
     and condominio_id = p_condominio
     and ativo = true;

  if v_role is null and not public.is_admin_onway() then
    raise exception 'Sem acesso a esse condomínio.' using errcode = 'P0001';
  end if;

  update public.perfis
     set condominio_id = p_condominio,
         role = coalesce(v_role, role)
   where id = auth.uid();
end $$;

grant execute on function public.set_active_condominio(uuid) to authenticated;

-- ============================================================
-- Auto-sync: quando perfis insert/update, espelha em perfis_condominios
-- ============================================================
create or replace function public.sync_perfis_condominios()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if NEW.condominio_id is not null then
    insert into public.perfis_condominios (perfil_id, condominio_id, role, ativo)
    values (NEW.id, NEW.condominio_id, NEW.role, NEW.ativo)
    on conflict (perfil_id, condominio_id) do update
      set role = excluded.role,
          ativo = excluded.ativo;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_sync_perfis_condominios on public.perfis;
create trigger trg_sync_perfis_condominios
  after insert or update on public.perfis
  for each row execute function public.sync_perfis_condominios();
