-- 0039: anexos PDF do condomínio (regimento + modelo de notificação)
-- Cada condomínio pode anexar:
--   - PDF do regimento interno (usado pra futura extração automática de artigos)
--   - PDF modelo de notificação (template visual usado ao gerar multas/notificações)

alter table public.condominios
  add column if not exists regimento_pdf_url     text,
  add column if not exists modelo_notificacao_url text;

-- Bucket `condominio-anexos` — público leitura, escrita só por staff do condomínio.
-- Convenção de path: <condominio_id>/<tipo>/<arquivo>
insert into storage.buckets (id, name, public)
values ('condominio-anexos', 'condominio-anexos', true)
on conflict (id) do nothing;

drop policy if exists "condo_anexos_select" on storage.objects;
create policy "condo_anexos_select" on storage.objects
  for select
  using (bucket_id = 'condominio-anexos');

drop policy if exists "condo_anexos_insert" on storage.objects;
create policy "condo_anexos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'condominio-anexos'
    and public.storage_path_in_user_condominios(name)
  );

drop policy if exists "condo_anexos_update" on storage.objects;
create policy "condo_anexos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'condominio-anexos'
    and public.storage_path_in_user_condominios(name)
  )
  with check (
    bucket_id = 'condominio-anexos'
    and public.storage_path_in_user_condominios(name)
  );

drop policy if exists "condo_anexos_delete" on storage.objects;
create policy "condo_anexos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'condominio-anexos'
    and public.storage_path_in_user_condominios(name)
  );
