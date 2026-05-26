-- 0031: bucket `avatares` no Storage pra foto de perfil dos usuários.
-- Bucket público (leitura aberta) mas escrita restrita ao próprio usuário.
-- Convenção de path: <user_id>/<arquivo>.

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

-- SELECT: público (bucket público — qualquer um carrega o avatar)
drop policy if exists "avatares_select" on storage.objects;
create policy "avatares_select" on storage.objects
  for select
  using (bucket_id = 'avatares');

-- INSERT: só na própria pasta
drop policy if exists "avatares_insert_own" on storage.objects;
create policy "avatares_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: só na própria pasta
drop policy if exists "avatares_update_own" on storage.objects;
create policy "avatares_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: só na própria pasta
drop policy if exists "avatares_delete_own" on storage.objects;
create policy "avatares_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
