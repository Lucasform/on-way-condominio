-- 0021_quotas_plano.sql
-- Cotas por plano + view de uso atual + trigger de bloqueio em INSERT.
-- Planos suportados (já existem em condominios.plano): 'free', 'pro', 'premium'.

create or replace function public.plano_quota(p_plano text, p_recurso text)
returns int
language sql immutable
as $$
  select case p_plano
    when 'free' then case p_recurso
      when 'unidades'    then 50
      when 'usuarios'    then 30
      when 'pessoas'     then 100
      when 'ocorrencias_mes' then 50
      else 1000000 end
    when 'pro' then case p_recurso
      when 'unidades'    then 300
      when 'usuarios'    then 200
      when 'pessoas'     then 800
      when 'ocorrencias_mes' then 500
      else 1000000 end
    when 'premium' then case p_recurso
      when 'unidades'    then 2000
      when 'usuarios'    then 1500
      when 'pessoas'     then 5000
      when 'ocorrencias_mes' then 5000
      else 1000000 end
    else 1000000  -- planos desconhecidos = ilimitado
  end;
$$;

grant execute on function public.plano_quota(text, text) to authenticated;

-- View pra dashboard: uso atual vs limite
create or replace view public.condominio_uso as
select
  c.id as condominio_id,
  c.nome,
  c.plano,
  (select count(*) from public.unidades u where u.condominio_id = c.id) as unidades_atual,
  public.plano_quota(c.plano, 'unidades') as unidades_max,
  (select count(*) from public.pessoas p where p.condominio_id = c.id and p.ativo) as pessoas_atual,
  public.plano_quota(c.plano, 'pessoas') as pessoas_max,
  (select count(*) from public.perfis pf where pf.condominio_id = c.id and pf.ativo) as usuarios_atual,
  public.plano_quota(c.plano, 'usuarios') as usuarios_max
from public.condominios c;

grant select on public.condominio_uso to authenticated;

-- Trigger: bloquear INSERT que exceda quota
create or replace function public.check_quota_unidades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual int;
  v_max int;
  v_plano text;
begin
  select plano into v_plano from public.condominios where id = NEW.condominio_id;
  v_max := public.plano_quota(coalesce(v_plano, 'free'), 'unidades');
  select count(*) into v_atual from public.unidades where condominio_id = NEW.condominio_id;
  if v_atual >= v_max then
    raise exception 'Limite de % unidades atingido no plano %.', v_max, v_plano
      using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_quota_unidades on public.unidades;
create trigger trg_quota_unidades
  before insert on public.unidades
  for each row execute function public.check_quota_unidades();

create or replace function public.check_quota_pessoas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual int;
  v_max int;
  v_plano text;
begin
  select plano into v_plano from public.condominios where id = NEW.condominio_id;
  v_max := public.plano_quota(coalesce(v_plano, 'free'), 'pessoas');
  select count(*) into v_atual from public.pessoas where condominio_id = NEW.condominio_id and ativo;
  if v_atual >= v_max then
    raise exception 'Limite de % pessoas atingido no plano %.', v_max, v_plano
      using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_quota_pessoas on public.pessoas;
create trigger trg_quota_pessoas
  before insert on public.pessoas
  for each row execute function public.check_quota_pessoas();

create or replace function public.check_quota_usuarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual int;
  v_max int;
  v_plano text;
begin
  if NEW.condominio_id is null then return NEW; end if;  -- admin_onway é cross-condo
  select plano into v_plano from public.condominios where id = NEW.condominio_id;
  v_max := public.plano_quota(coalesce(v_plano, 'free'), 'usuarios');
  select count(*) into v_atual from public.perfis where condominio_id = NEW.condominio_id and ativo;
  if v_atual >= v_max then
    raise exception 'Limite de % usuários atingido no plano %.', v_max, v_plano
      using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_quota_usuarios on public.perfis;
create trigger trg_quota_usuarios
  before insert on public.perfis
  for each row execute function public.check_quota_usuarios();
