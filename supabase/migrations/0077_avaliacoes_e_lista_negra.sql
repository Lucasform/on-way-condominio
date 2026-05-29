-- 0077_avaliacoes_e_lista_negra.sql
-- 1) Avaliacoes de fornecedores (1 a 5 estrelas + comentario)
-- 2) Lista negra de pessoas barradas no condominio (bloqueia liberacao de
--    acesso por qualquer unidade)

-- ============================================================
-- 1) Avaliacoes
-- ============================================================
create table public.fornecedor_avaliacoes (
  id              uuid primary key default gen_random_uuid(),
  fornecedor_id   uuid not null
                  references public.condominio_fornecedores(id) on delete cascade,
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  user_id         uuid not null
                  references auth.users(id) on delete cascade,
  estrelas        integer not null check (estrelas between 1 and 5),
  comentario      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (fornecedor_id, user_id)
);

create index fornecedor_avaliacoes_fornecedor_idx
  on public.fornecedor_avaliacoes (fornecedor_id);

create trigger trg_fornecedor_avaliacoes_updated_at
before update on public.fornecedor_avaliacoes
for each row execute function public.set_updated_at();

alter table public.fornecedor_avaliacoes enable row level security;
alter table public.fornecedor_avaliacoes force row level security;

create policy fornecedor_avaliacoes_select on public.fornecedor_avaliacoes
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

create policy fornecedor_avaliacoes_insert on public.fornecedor_avaliacoes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and condominio_id in (select public.user_condominios())
  );

create policy fornecedor_avaliacoes_update on public.fornecedor_avaliacoes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy fornecedor_avaliacoes_delete on public.fornecedor_avaliacoes
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- 2) Lista negra do condominio
-- ============================================================
create table public.condominio_lista_negra (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null
                  references public.condominios(id) on delete cascade,
  nome            text not null,
  documento_tipo  text check (documento_tipo in ('cpf','rg','cnh','passaporte','outro')),
  documento_numero text,
  motivo          text,
  ativo           boolean not null default true,
  registrado_por  uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index condominio_lista_negra_idx
  on public.condominio_lista_negra (condominio_id, ativo);

create index condominio_lista_negra_doc_idx
  on public.condominio_lista_negra (condominio_id, documento_numero)
  where documento_numero is not null;

create trigger trg_condominio_lista_negra_updated_at
before update on public.condominio_lista_negra
for each row execute function public.set_updated_at();

alter table public.condominio_lista_negra enable row level security;
alter table public.condominio_lista_negra force row level security;

-- SELECT: staff do condo + admin (morador nao ve lista negra, e politica interna)
create policy condominio_lista_negra_select on public.condominio_lista_negra
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in (
        'administradora','sindico','portaria','ronda'
      )
    )
  );

create policy condominio_lista_negra_insert on public.condominio_lista_negra
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

create policy condominio_lista_negra_update on public.condominio_lista_negra
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

create policy condominio_lista_negra_delete on public.condominio_lista_negra
  for delete to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- 3) Funcao helper pra checar se nome/doc esta barrado
-- ============================================================
create or replace function public.esta_na_lista_negra(
  p_condominio uuid,
  p_documento text,
  p_nome text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.condominio_lista_negra
    where condominio_id = p_condominio
      and ativo = true
      and (
        (p_documento is not null and documento_numero is not null
         and regexp_replace(documento_numero, '\D', '', 'g')
           = regexp_replace(p_documento, '\D', '', 'g'))
        or (
          p_documento is null
          and lower(nome) = lower(p_nome)
        )
      )
  );
$$;
