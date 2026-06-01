-- 0082_quotas_liberadas.sql
-- Decisão Lucas (2026-05-29): liberar todos os planos de limite enquanto o
-- modelo de cobrança não está rodando. A estrutura de quotas (função
-- plano_quota + triggers check_quota_*) fica intacta pra plugar limites
-- depois sem refactor. Basta ajustar a função plano_quota.
--
-- Diagnóstico: import em massa de unidades parava em 50 porque o plano
-- 'free' tinha cota de 50 unidades, 30 usuários e 100 pessoas. Triggers
-- BEFORE INSERT em unidades/pessoas/perfis usam plano_quota pra bloquear.

create or replace function public.plano_quota(p_plano text, p_recurso text)
returns int
language sql immutable
as $$
  -- Limites desligados pra todos os planos enquanto não cobramos.
  -- Quando ativar billing, restaurar a tabela de limites por plano aqui.
  select 1000000;
$$;

grant execute on function public.plano_quota(text, text) to authenticated;
