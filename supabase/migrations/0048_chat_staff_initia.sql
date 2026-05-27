-- 0048_chat_staff_inicia.sql
-- Permite que staff (sindico, subsindico, administradora, portaria, ronda)
-- abra conversas em nome de moradores do mesmo condominio. A policy
-- antiga exigia morador_user_id = auth.uid(), o que so deixava o morador
-- abrir pra si proprio.

drop policy if exists conversas_insert on public.conversas;

create policy conversas_insert on public.conversas
  for insert to authenticated
  with check (
    -- Caso 1: morador abrindo pra si proprio
    (
      morador_user_id = auth.uid()
      and (
        public.is_admin_onway()
        or condominio_id in (select public.user_condominios())
      )
    )
    -- Caso 2: staff abrindo em nome do morador (no proprio condo)
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id)
          in ('administradora','sindico','portaria','ronda')
    )
    -- Caso 3: admin_onway
    or public.is_admin_onway()
  );
