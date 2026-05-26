-- 0019_convites.sql
-- Fase B (segurança): códigos de convite por condomínio para signup público.
-- Modelo: síndico/admin gera código, morador entra em /signup com esse código
-- e cria perfil já vinculado ao condomínio com role 'morador'.

-- ============================================================
-- 1) Tabela convites_condominio
-- ============================================================
create table public.convites_condominio (
  id              uuid primary key default gen_random_uuid(),
  condominio_id   uuid not null references public.condominios(id) on delete cascade,
  codigo          text not null unique,            -- ex: "FLAMBOYANT-2026"
  role            text not null default 'morador'
                  check (role in ('morador','portaria','ronda')),
  usos_max        int  not null default 1
                  check (usos_max >= 1),
  usos            int  not null default 0,
  expira_em       timestamptz not null,
  revogado        boolean not null default false,
  criado_por      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index convites_condominio_idx       on public.convites_condominio (condominio_id);
create index convites_codigo_ativo_idx     on public.convites_condominio (codigo) where revogado = false;

create trigger trg_convites_updated_at
before update on public.convites_condominio
for each row execute function public.set_updated_at();

-- ============================================================
-- 2) RLS
-- ============================================================
alter table public.convites_condominio enable row level security;
alter table public.convites_condominio force row level security;

-- SELECT: admin_onway tudo; sindico/administradora veem do próprio condo
create policy convites_select on public.convites_condominio
  for select to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) in ('administradora','sindico')
  );

-- INSERT: admin_onway / administradora / sindico
create policy convites_insert on public.convites_condominio
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) in ('administradora','sindico')
  );

-- UPDATE: idem (usado para revogar)
create policy convites_update on public.convites_condominio
  for update to authenticated
  using (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) in ('administradora','sindico')
  )
  with check (
    public.is_admin_onway()
    or public.user_role_in(condominio_id) in ('administradora','sindico')
  );

-- DELETE: apenas admin_onway (preferir revogar)
create policy convites_delete on public.convites_condominio
  for delete to authenticated
  using (public.is_admin_onway());

-- ============================================================
-- 3) RPC pública para LER metadados de um código (sem expor outros campos)
--    Usada pelo /signup antes do user ter sessão.
-- ============================================================
create or replace function public.preview_convite(p_codigo text)
returns table (
  condominio_id uuid,
  nome_condominio text,
  role text,
  valido boolean,
  motivo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.convites_condominio%rowtype;
  v_nome text;
begin
  select * into v_conv
    from public.convites_condominio
   where codigo = upper(trim(p_codigo))
   limit 1;

  if not found then
    return query select null::uuid, null::text, null::text, false, 'codigo_nao_encontrado';
    return;
  end if;

  if v_conv.revogado then
    return query select v_conv.condominio_id, null::text, v_conv.role, false, 'revogado';
    return;
  end if;

  if v_conv.expira_em < now() then
    return query select v_conv.condominio_id, null::text, v_conv.role, false, 'expirado';
    return;
  end if;

  if v_conv.usos >= v_conv.usos_max then
    return query select v_conv.condominio_id, null::text, v_conv.role, false, 'esgotado';
    return;
  end if;

  select nome into v_nome from public.condominios where id = v_conv.condominio_id;

  return query select v_conv.condominio_id, v_nome, v_conv.role, true, null::text;
end $$;

grant execute on function public.preview_convite(text) to anon, authenticated;

-- ============================================================
-- 4) Função pra registrar uso do código (chamada pela Edge redeem-invite-code)
--    Atomicamente incrementa usos e retorna sucesso/erro.
-- ============================================================
create or replace function public.consumir_convite(p_codigo text)
returns table (
  condominio_id uuid,
  role text,
  ok boolean,
  motivo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.convites_condominio%rowtype;
begin
  -- lock pra evitar race em usos_max
  select * into v_conv
    from public.convites_condominio
   where codigo = upper(trim(p_codigo))
   for update;

  if not found then
    return query select null::uuid, null::text, false, 'codigo_nao_encontrado';
    return;
  end if;

  if v_conv.revogado then
    return query select v_conv.condominio_id, v_conv.role, false, 'revogado';
    return;
  end if;
  if v_conv.expira_em < now() then
    return query select v_conv.condominio_id, v_conv.role, false, 'expirado';
    return;
  end if;
  if v_conv.usos >= v_conv.usos_max then
    return query select v_conv.condominio_id, v_conv.role, false, 'esgotado';
    return;
  end if;

  update public.convites_condominio
     set usos = usos + 1
   where id = v_conv.id;

  return query select v_conv.condominio_id, v_conv.role, true, null::text;
end $$;

-- Só chamada pela service role na Edge, não exponha ao client.
revoke all on function public.consumir_convite(text) from public, anon, authenticated;
