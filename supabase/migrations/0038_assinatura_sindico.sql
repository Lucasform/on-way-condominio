-- 0038: assinatura digital (imagem) do síndico/administradora.
-- Cada user de staff sobe a própria assinatura; ela é embeddada nos PDFs
-- de multa/notificação que ele emite.
-- NÃO é assinatura ICP-Brasil — é só representação visual.

-- 1) Coluna no perfis
alter table public.perfis
  add column if not exists assinatura_url text;

-- 2) Bucket Storage `assinaturas` — público leitura, escrita só pelo dono.
-- Convenção de path: <user_id>/<arquivo>
insert into storage.buckets (id, name, public)
values ('assinaturas', 'assinaturas', true)
on conflict (id) do nothing;

drop policy if exists "assinaturas_select" on storage.objects;
create policy "assinaturas_select" on storage.objects
  for select
  using (bucket_id = 'assinaturas');

drop policy if exists "assinaturas_insert_own" on storage.objects;
create policy "assinaturas_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "assinaturas_update_own" on storage.objects;
create policy "assinaturas_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "assinaturas_delete_own" on storage.objects;
create policy "assinaturas_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assinaturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
