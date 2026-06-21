-- 0102_security_hardening.sql
-- Melhorias de segurança sem breaking changes:
--   1. Audit trigger em feature_flags (quem alterou, quando, de/para)
--   2. Audit trigger em assinaturas (mudanças de plano/status)
--   3. Função + pg_cron para expirar trials automaticamente às 3h

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Audit trigger: feature_flags
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.audit_feature_flag_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.audit_log (ator_id, ator_role, acao, alvo_tipo, alvo_id, detalhes)
  values (
    auth.uid(),
    coalesce((select role from public.perfis where id = auth.uid()), 'system'),
    case tg_op when 'UPDATE' then 'feature_flag.update' else 'feature_flag.insert' end,
    'feature_flag',
    new.key,
    jsonb_build_object(
      'key',           new.key,
      'ativo_antes',   case tg_op when 'UPDATE' then old.ativo else null end,
      'ativo_depois',  new.ativo
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_feature_flags on public.feature_flags;
create trigger trg_audit_feature_flags
  after insert or update on public.feature_flags
  for each row execute function public.audit_feature_flag_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Audit trigger: assinaturas
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.audit_assinatura_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  -- só loga quando há mudança real em campos relevantes
  if tg_op = 'UPDATE'
     and old.status = new.status
     and old.plano_id is not distinct from new.plano_id
     and old.features_plano is not distinct from new.features_plano
     and old.features_extras is not distinct from new.features_extras
  then
    return new;
  end if;

  insert into public.audit_log (ator_id, ator_role, acao, alvo_tipo, alvo_id, condominio_id, detalhes)
  values (
    auth.uid(),
    coalesce((select role from public.perfis where id = auth.uid()), 'system'),
    case tg_op when 'UPDATE' then 'assinatura.update' else 'assinatura.create' end,
    'assinatura',
    new.id::text,
    new.condominio_id,
    jsonb_build_object(
      'status_antes',          case tg_op when 'UPDATE' then old.status else null end,
      'status_depois',         new.status,
      'plano_antes',           case tg_op when 'UPDATE' then old.plano_id else null end,
      'plano_depois',          new.plano_id,
      'features_extras_antes', case tg_op when 'UPDATE' then old.features_extras else null end,
      'features_extras_depois',new.features_extras
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_assinaturas on public.assinaturas;
create trigger trg_audit_assinaturas
  after insert or update on public.assinaturas
  for each row execute function public.audit_assinatura_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Expiração automática de trials via pg_cron
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.expire_trials()
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.assinaturas
  set    status = 'inadimplente',
         updated_at = now()
  where  status = 'trial'
    and  trial_ends_at is not null
    and  trial_ends_at < now();

  get diagnostics v_count = row_count;

  -- registra na auditoria para rastreabilidade
  if v_count > 0 then
    insert into public.audit_log (ator_role, acao, alvo_tipo, detalhes)
    values (
      'system',
      'trial.expirado_em_lote',
      'assinatura',
      jsonb_build_object('quantidade', v_count, 'executado_em', now())
    );
  end if;
end;
$$;

-- Agenda pg_cron para rodar todo dia às 03:00 UTC (00:00 BRT)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'trial-expiry-daily') then
    perform cron.schedule('trial-expiry-daily', '0 3 * * *', 'select public.expire_trials()');
  end if;
end;
$$;
