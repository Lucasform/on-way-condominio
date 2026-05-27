-- 0059_push_crons.sql
-- FASE 15 / Leva C — colunas de tracking dos pushes automáticos + agendamento pg_cron.

-- ============================================================
-- 1) Colunas pra evitar notificar duas vezes
-- ============================================================
alter table public.eventos
  add column if not exists push_24h_at timestamptz;

alter table public.votacoes
  add column if not exists push_abertura_at timestamptz,
  add column if not exists push_encerramento_at timestamptz;

alter table public.encomendas
  add column if not exists push_alerta_at timestamptz;

-- Quando a votação é encerrada manualmente, não queremos disparar o push de
-- encerramento depois. Marca-se ao mudar status, via UI. Reset (push_*=null)
-- só faz sentido em testes.

-- ============================================================
-- 2) Garante pg_cron disponível
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 3) Helpers pra construir headers + URL
-- ============================================================
-- pg_cron precisa de URL + service_role fixos. Salvamos em supabase_functions
-- schema settings via Vault, ou inline aqui. Como Supabase managed expõe via
-- current_setting('app.settings.*'), preferimos inline com fallback.

create or replace function public.invocar_edge_function(p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- supabase_url / service_role: configurar via vault.create_secret ou GUC
  -- (instâncias managed setam automaticamente via supabase.config).
  v_url := coalesce(current_setting('app.settings.supabase_url', true),
                    current_setting('supabase.url', true));
  v_key := coalesce(current_setting('app.settings.service_role_key', true),
                    current_setting('supabase.service_role_key', true));
  if v_url is null or v_key is null then
    raise notice 'pg_cron: SUPABASE_URL ou SERVICE_ROLE_KEY ausente em settings — pulando %', p_nome;
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/' || p_nome,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- ============================================================
-- 4) Agendamentos
-- ============================================================
-- Remove agendamentos antigos com mesmo nome (idempotente)
do $$ begin
  perform cron.unschedule(jobname) from cron.job where jobname in (
    'onway_notify_eventos_amanha',
    'onway_notify_votacoes',
    'onway_notify_encomendas_paradas'
  );
exception when others then null;
end $$;

-- Diário 08:00 UTC (≈ 05:00 BRT)
select cron.schedule(
  'onway_notify_eventos_amanha',
  '0 8 * * *',
  $$select public.invocar_edge_function('notify-eventos-amanha');$$
);

-- A cada hora
select cron.schedule(
  'onway_notify_votacoes',
  '0 * * * *',
  $$select public.invocar_edge_function('notify-votacoes');$$
);

-- Diário 12:00 UTC (≈ 09:00 BRT)
select cron.schedule(
  'onway_notify_encomendas_paradas',
  '0 12 * * *',
  $$select public.invocar_edge_function('notify-encomendas-paradas');$$
);
