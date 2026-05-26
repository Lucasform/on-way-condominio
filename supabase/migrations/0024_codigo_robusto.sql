-- 0024_codigo_robusto.sql
-- Normalização robusta de código de convite (tira whitespace interno, invisíveis)

create or replace function public.normalizar_codigo(p text)
returns text
language sql immutable
as $$
  select upper(regexp_replace(coalesce(p, ''), '[[:space:]]', '', 'g'));
$$;

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
  v_norm text;
begin
  v_norm := public.normalizar_codigo(p_codigo);

  select * into v_conv
    from public.convites_condominio
   where public.normalizar_codigo(codigo) = v_norm
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
  v_norm text;
begin
  v_norm := public.normalizar_codigo(p_codigo);

  select * into v_conv
    from public.convites_condominio
   where public.normalizar_codigo(codigo) = v_norm
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

revoke all on function public.consumir_convite(text) from public, anon, authenticated;

-- Trigger pra normalizar no INSERT/UPDATE: salva já limpo (defesa em profundidade)
create or replace function public.tg_normalizar_codigo_convite()
returns trigger
language plpgsql
as $$
begin
  NEW.codigo := public.normalizar_codigo(NEW.codigo);
  return NEW;
end $$;

drop trigger if exists trg_normalizar_codigo on public.convites_condominio;
create trigger trg_normalizar_codigo
  before insert or update of codigo on public.convites_condominio
  for each row execute function public.tg_normalizar_codigo_convite();
