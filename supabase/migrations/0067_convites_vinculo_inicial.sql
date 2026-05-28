-- 0067_convites_vinculo_inicial.sql
-- Vínculo inicial no convite: síndico/admin já pode amarrar o código a uma
-- unidade (morador) e/ou sugerir um setor (funcionário) + nome travado.
-- Edge redeem-invite-code passa a criar pessoas junto com perfis nesse caso.

alter table public.convites_condominio
  add column if not exists unidade_id   uuid references public.unidades(id) on delete set null,
  add column if not exists setor        text,
  add column if not exists pessoa_nome  text,
  add column if not exists tipo_vinculo text
    check (tipo_vinculo is null or tipo_vinculo in
      ('titular','conjuge','filho','dependente','inquilino','morador','funcionario','outro'));

create index if not exists convites_condominio_unidade_idx
  on public.convites_condominio (unidade_id)
  where unidade_id is not null;

-- preview_convite: devolve unidade/setor/pessoa_nome/tipo_vinculo pro front exibir contexto
drop function if exists public.preview_convite(text);
create or replace function public.preview_convite(p_codigo text)
returns table (
  condominio_id    uuid,
  nome_condominio  text,
  role             text,
  unidade_id       uuid,
  unidade_label    text,
  setor            text,
  pessoa_nome      text,
  tipo_vinculo     text,
  valido           boolean,
  motivo           text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.convites_condominio%rowtype;
  v_nome text;
  v_norm text;
  v_uni  text;
begin
  v_norm := public.normalizar_codigo(p_codigo);

  select * into v_conv
    from public.convites_condominio
   where public.normalizar_codigo(codigo) = v_norm
   limit 1;

  if not found then
    return query select null::uuid, null::text, null::text, null::uuid, null::text, null::text, null::text, null::text, false, 'codigo_nao_encontrado';
    return;
  end if;

  if v_conv.revogado then
    return query select v_conv.condominio_id, null::text, v_conv.role, v_conv.unidade_id, null::text, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, false, 'revogado';
    return;
  end if;
  if v_conv.expira_em < now() then
    return query select v_conv.condominio_id, null::text, v_conv.role, v_conv.unidade_id, null::text, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, false, 'expirado';
    return;
  end if;
  if v_conv.usos >= v_conv.usos_max then
    return query select v_conv.condominio_id, null::text, v_conv.role, v_conv.unidade_id, null::text, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, false, 'esgotado';
    return;
  end if;

  select nome into v_nome from public.condominios where id = v_conv.condominio_id;

  if v_conv.unidade_id is not null then
    select coalesce(bloco || ' - ', '') || numero into v_uni
      from public.unidades where id = v_conv.unidade_id;
  end if;

  return query select v_conv.condominio_id, v_nome, v_conv.role, v_conv.unidade_id, v_uni, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, true, null::text;
end $$;

grant execute on function public.preview_convite(text) to anon, authenticated;

-- consumir_convite: igual, devolve campos novos pra edge poder criar pessoa
drop function if exists public.consumir_convite(text);
create or replace function public.consumir_convite(p_codigo text)
returns table (
  condominio_id  uuid,
  role           text,
  unidade_id     uuid,
  setor          text,
  pessoa_nome    text,
  tipo_vinculo   text,
  ok             boolean,
  motivo         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.convites_condominio%rowtype;
  v_norm text;
begin
  v_norm := public.normalizar_codigo(p_codigo);

  select * into v_conv
    from public.convites_condominio
   where public.normalizar_codigo(codigo) = v_norm
   for update;

  if not found then
    return query select null::uuid, null::text, null::uuid, null::text, null::text, null::text, false, 'codigo_nao_encontrado';
    return;
  end if;
  if v_conv.revogado then
    return query select v_conv.condominio_id, v_conv.role, v_conv.unidade_id, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, false, 'revogado';
    return;
  end if;
  if v_conv.expira_em < now() then
    return query select v_conv.condominio_id, v_conv.role, v_conv.unidade_id, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, false, 'expirado';
    return;
  end if;
  if v_conv.usos >= v_conv.usos_max then
    return query select v_conv.condominio_id, v_conv.role, v_conv.unidade_id, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, false, 'esgotado';
    return;
  end if;

  update public.convites_condominio set usos = usos + 1 where id = v_conv.id;

  return query select v_conv.condominio_id, v_conv.role, v_conv.unidade_id, v_conv.setor, v_conv.pessoa_nome, v_conv.tipo_vinculo, true, null::text;
end $$;

revoke all on function public.consumir_convite(text) from public, anon, authenticated;

-- listar_unidades_de_convite: RPC pública (anônima) que devolve apenas
-- (id, bloco, numero) das unidades de um condomínio, MAS só quando o caller
-- prova ter um código de convite VÁLIDO desse condo (anti-enumeração).
create or replace function public.listar_unidades_de_convite(p_codigo text)
returns table (
  id     uuid,
  bloco  text,
  numero text,
  label  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.convites_condominio%rowtype;
  v_norm text;
begin
  v_norm := public.normalizar_codigo(p_codigo);

  select * into v_conv
    from public.convites_condominio
   where public.normalizar_codigo(codigo) = v_norm
   limit 1;

  if not found or v_conv.revogado or v_conv.expira_em < now() or v_conv.usos >= v_conv.usos_max then
    return;
  end if;

  return query
    select u.id,
           u.bloco,
           u.numero,
           coalesce(u.bloco || ' - ', '') || u.numero as label
      from public.unidades u
     where u.condominio_id = v_conv.condominio_id
       and u.ativo = true
     order by u.bloco nulls first, u.numero;
end $$;

grant execute on function public.listar_unidades_de_convite(text) to anon, authenticated;
