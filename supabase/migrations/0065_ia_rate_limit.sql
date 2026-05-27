-- 0060_ia_rate_limit.sql
-- FASE 15 / Leva F — rate limit das edges IA (analyze-ocorrencia, improve-template,
-- suggest-chat-reply). 30 chamadas/hora/user.

create table if not exists public.ia_rate_limit (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  count         integer not null default 0,
  window_start  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ia_rate_limit_window_idx on public.ia_rate_limit (window_start);

-- Sem RLS pra users: edges falam via service_role.
alter table public.ia_rate_limit enable row level security;
-- admin pode ler pra debug
create policy ia_rate_limit_admin_read on public.ia_rate_limit
  for select to authenticated using (public.is_admin_onway());

-- ============================================================
-- Função: incrementa contador e retorna se pode ou não chamar.
-- Janela de 1 hora rolling. Limite default 30.
-- ============================================================
create or replace function public.ia_consume_rate_limit(
  p_user_id uuid,
  p_limit   integer default 30,
  p_window  interval default '1 hour'
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ia_rate_limit%rowtype;
begin
  -- Tenta carregar a row do usuário
  select * into v_row from public.ia_rate_limit where user_id = p_user_id for update;

  if not found then
    insert into public.ia_rate_limit(user_id, count, window_start, updated_at)
    values (p_user_id, 1, now(), now())
    returning * into v_row;
    return query select true, p_limit - 1, v_row.window_start + p_window;
    return;
  end if;

  -- Janela expirou? Reseta.
  if v_row.window_start + p_window < now() then
    update public.ia_rate_limit
       set count = 1, window_start = now(), updated_at = now()
     where user_id = p_user_id
    returning * into v_row;
    return query select true, p_limit - 1, v_row.window_start + p_window;
    return;
  end if;

  if v_row.count >= p_limit then
    return query select false, 0, v_row.window_start + p_window;
    return;
  end if;

  update public.ia_rate_limit
     set count = count + 1, updated_at = now()
   where user_id = p_user_id
  returning * into v_row;
  return query select true, p_limit - v_row.count, v_row.window_start + p_window;
end;
$$;

grant execute on function public.ia_consume_rate_limit(uuid, integer, interval) to authenticated, service_role;
