-- Migration 0112: Adiciona subsindico e conselheiro às policies de SELECT
-- Esses roles precisam ler ocorrências, multas e chamados do próprio condomínio,
-- mas não estavam incluídos nas policies originais (0004, 0005, 0013).

-- ============================================================
-- Ocorrências: adiciona subsindico e conselheiro ao SELECT
-- ============================================================
drop policy if exists ocorrencias_select on public.ocorrencias;
create policy ocorrencias_select on public.ocorrencias
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','subsindico','conselheiro','portaria','ronda')
    )
    or reportado_por = auth.uid()
    or pessoa_envolvida_id in (
      select id from public.pessoas where user_id = auth.uid()
    )
  );

-- ============================================================
-- Multas: adiciona subsindico e conselheiro ao SELECT
-- ============================================================
drop policy if exists multas_select on public.multas;
create policy multas_select on public.multas
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','subsindico','conselheiro','portaria','ronda')
    )
    or pessoa_id in (
      select id from public.pessoas where user_id = auth.uid()
    )
  );

-- ============================================================
-- Chamados: adiciona subsindico e conselheiro ao SELECT
-- ============================================================
drop policy if exists chamados_select on public.chamados;
create policy chamados_select on public.chamados
  for select to authenticated
  using (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','subsindico','conselheiro','portaria','ronda')
    )
    or aberto_por = auth.uid()
  );
