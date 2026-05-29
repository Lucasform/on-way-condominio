-- 0080_monthly_reports.sql
-- Registra envios de resumo executivo mensal pra evitar reprocessamento.
-- Edge function `monthly-report` agendada via pg_cron 1a segunda do mes 09h UTC.

create table if not exists public.monthly_reports_enviados (
  condominio_id  uuid not null
                 references public.condominios(id) on delete cascade,
  ano_mes        text not null check (ano_mes ~ '^\d{4}-\d{2}$'),
  enviado_em     timestamptz not null default now(),
  destinatarios  integer not null default 0,
  primary key (condominio_id, ano_mes)
);

alter table public.monthly_reports_enviados enable row level security;
alter table public.monthly_reports_enviados force row level security;

create policy monthly_reports_select on public.monthly_reports_enviados
  for select to authenticated
  using (
    public.is_admin_onway()
    or condominio_id in (select public.user_condominios())
  );

-- Agendamento: roda dia 1 de cada mes as 09h UTC (06h Brasilia)
-- Pega o mes anterior automaticamente
select cron.schedule(
  'onway_monthly_report',
  '0 9 1 * *',
  $$ select public.invocar_edge_function('monthly-report'); $$
);
