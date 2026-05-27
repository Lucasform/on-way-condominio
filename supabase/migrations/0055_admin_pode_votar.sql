-- 0055_admin_pode_votar.sql
-- A policy votos_insert exigia que o votante fosse membro do condominio
-- da votacao (via user_condominios()). Admin_onway, fora de view-as,
-- nao tem condominio_id no perfil, entao nao conseguia votar.
-- Adiciona is_admin_onway() na policy.

drop policy if exists votos_insert on public.votos;
create policy votos_insert on public.votos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.votacoes v
       where v.id = votacao_id
         and v.status = 'aberta'
         and (v.data_fim is null or v.data_fim > now())
         and (
           public.is_admin_onway()
           or v.condominio_id in (select public.user_condominios())
         )
    )
  );
