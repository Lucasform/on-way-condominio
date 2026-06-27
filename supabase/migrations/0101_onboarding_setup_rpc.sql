-- RPC usada pela edge function onboarding-setup para criar
-- condominio + perfil + assinatura de forma atômica.
-- Roda como SECURITY DEFINER para bypassar RLS.

create or replace function public.onboarding_create_condo(
  p_user_id       uuid,
  p_nome          text,
  p_nome_condo    text,
  p_cep           text default null,
  p_cidade        text default null,
  p_estado        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condo_id uuid;
  v_trial_end timestamptz;
begin
  -- Cria condomínio
  insert into public.condominios (nome, cep, cidade, estado, ativo, permite_signup)
  values (p_nome_condo, p_cep, p_cidade, p_estado, true, true)
  returning id into v_condo_id;

  -- Cria perfil síndico
  insert into public.perfis (id, condominio_id, role, nome_exibicao, ativo)
  values (p_user_id, v_condo_id, 'sindico', p_nome, true);

  -- Cria assinatura trial 10 dias
  v_trial_end := now() + interval '10 days';
  insert into public.assinaturas (condominio_id, plano_id, status, trial_ends_at, features_plano, features_extras)
  values (v_condo_id, 'profissional', 'trial', v_trial_end, '{}', '{}')
  on conflict (condominio_id) do nothing;

  return jsonb_build_object('condominio_id', v_condo_id);
end;
$$;

-- Só a service role pode chamar
revoke all on function public.onboarding_create_condo from public, anon, authenticated;
grant execute on function public.onboarding_create_condo to service_role;
