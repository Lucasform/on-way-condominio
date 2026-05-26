-- 0030: campos de perfil pessoal em `perfis`.
-- Permite que admin_onway (que não tem pessoa) edite avatar, telefone e bio,
-- e centraliza esses dados pra todos os roles em /meu-perfil.

alter table public.perfis
  add column if not exists telefone   text,
  add column if not exists avatar_url text,
  add column if not exists bio        text;

-- RLS já está em perfis; a policy de UPDATE existente já permite ao próprio
-- usuário editar (id = auth.uid()), então não precisa criar policy nova.
