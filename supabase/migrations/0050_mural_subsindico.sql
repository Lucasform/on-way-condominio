-- 0050_mural_subsindico.sql
-- A 0009_mural listou direto p.role in ('administradora','sindico') na
-- policy de storage e em mural_imagens_*. Como nao passa por
-- user_role_in(), subsindico fica de fora. Adiciona subsindico nas
-- mesmas policies pra alinhar com o resto do app.

-- ============================================================
-- 1) publicacoes (insert e update)
-- ============================================================
drop policy if exists publicacoes_insert on public.publicacoes;
create policy publicacoes_insert on public.publicacoes
  for insert to authenticated
  with check (
    public.is_admin_onway()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

drop policy if exists publicacoes_update on public.publicacoes;
create policy publicacoes_update on public.publicacoes
  for update to authenticated
  using (
    public.is_admin_onway()
    or autor_id = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  )
  with check (
    public.is_admin_onway()
    or autor_id = auth.uid()
    or (
      condominio_id in (select public.user_condominios())
      and public.user_role_in(condominio_id) in ('administradora','sindico')
    )
  );

-- ============================================================
-- 2) storage bucket mural-imagens
-- ============================================================
drop policy if exists "mural_imagens_insert" on storage.objects;
create policy "mural_imagens_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mural-imagens'
    and (
      public.is_admin_onway()
      or exists (
        select 1
          from public.perfis p
         where p.id = auth.uid()
           and p.ativo = true
           and p.role in ('administradora','sindico','subsindico')
           and p.condominio_id is not null
           and starts_with(name, p.condominio_id::text || '/')
      )
    )
  );

drop policy if exists "mural_imagens_update" on storage.objects;
create policy "mural_imagens_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'mural-imagens'
    and (
      public.is_admin_onway()
      or exists (
        select 1
          from public.perfis p
         where p.id = auth.uid()
           and p.ativo = true
           and p.role in ('administradora','sindico','subsindico')
           and p.condominio_id is not null
           and starts_with(name, p.condominio_id::text || '/')
      )
    )
  );

drop policy if exists "mural_imagens_delete" on storage.objects;
create policy "mural_imagens_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mural-imagens'
    and (
      public.is_admin_onway()
      or exists (
        select 1
          from public.perfis p
         where p.id = auth.uid()
           and p.ativo = true
           and p.role in ('administradora','sindico','subsindico')
           and p.condominio_id is not null
           and starts_with(name, p.condominio_id::text || '/')
      )
    )
  );
