-- 0037: bucket `fotos-pessoas` no Storage pra foto de cadastro de morador.
-- Diferente do bucket `avatares` (que eh por user e RLS `auth.uid()::text`),
-- esse bucket eh por condominio — staff faz upload pra fotos de pessoas.
-- Bucket publico pra leitura (foto aparece em cards/listas).
-- Convencao de path: <condominio_id>/<timestamp>-<random>.<ext>

insert into storage.buckets (id, name, public)
values ('fotos-pessoas', 'fotos-pessoas', true)
on conflict (id) do nothing;

-- SELECT: publico (qualquer um carrega a foto)
drop policy if exists "fotos_pessoas_select" on storage.objects;
create policy "fotos_pessoas_select" on storage.objects
  for select
  using (bucket_id = 'fotos-pessoas');

-- INSERT/UPDATE/DELETE: usuario eh staff do condominio que aparece no path.
-- Reusamos a function `storage_path_in_user_condominios` ja existente
-- (criada em 0004 pra ocorrencia-fotos) que confere se o prefixo do path
-- bate com algum condominio do user.

drop policy if exists "fotos_pessoas_insert" on storage.objects;
create policy "fotos_pessoas_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-pessoas'
    and public.storage_path_in_user_condominios(name)
  );

drop policy if exists "fotos_pessoas_update" on storage.objects;
create policy "fotos_pessoas_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos-pessoas'
    and public.storage_path_in_user_condominios(name)
  )
  with check (
    bucket_id = 'fotos-pessoas'
    and public.storage_path_in_user_condominios(name)
  );

drop policy if exists "fotos_pessoas_delete" on storage.objects;
create policy "fotos_pessoas_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos-pessoas'
    and public.storage_path_in_user_condominios(name)
  );
