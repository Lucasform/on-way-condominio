-- 0047_convites_roles_expanded.sql
-- Permite que convites de codigo gerem perfis em mais papeis:
-- administradora, sindico, subsindico, conselheiro (alem dos ja existentes
-- morador, portaria, ronda).
-- admin_onway segue fora: e criado internamente, nunca via codigo.

alter table public.convites_condominio drop constraint if exists convites_condominio_role_check;
alter table public.convites_condominio
  add constraint convites_condominio_role_check
  check (role in (
    'morador','portaria','ronda',
    'administradora','sindico','subsindico','conselheiro'
  ));
