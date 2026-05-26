-- 0023_rate_limits.sql
-- Tabela genérica de rate limit + função pra checar/registrar.

create table if not exists public.rate_limits (
  id          bigserial primary key,
  bucket      text not null,
  identifier  text not null,
  ts          timestamptz not null default now()
);
create index if not exists rate_limits_lookup_idx
  on public.rate_limits (bucket, identifier, ts desc);

create or replace function public.check_rate_limit(
  p_bucket text,
  p_identifier text,
  p_limit int,
  p_window_secs int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.rate_limits
   where bucket = p_bucket
     and identifier = p_identifier
     and ts > now() - (p_window_secs || ' seconds')::interval;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limits (bucket, identifier) values (p_bucket, p_identifier);

  if random() < 0.01 then
    delete from public.rate_limits where ts < now() - interval '1 hour';
  end if;

  return true;
end $$;

revoke all on function public.check_rate_limit(text, text, int, int) from public, anon, authenticated;
