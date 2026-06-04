-- 0084_rate_limits_rls.sql
-- Fecha a tabela órfã public.rate_limits, que estava SEM RLS (logo exposta a
-- leitura/escrita via PostgREST com a anon key). Auditoria 2026-06-04.
--
-- Não precisa de policy: a única consumidora é a função check_rate_limit(),
-- que é SECURITY DEFINER (roda como owner e ignora RLS). service_role também
-- tem bypassrls. Sem policy = nega anon/authenticated no acesso direto à API.

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;
