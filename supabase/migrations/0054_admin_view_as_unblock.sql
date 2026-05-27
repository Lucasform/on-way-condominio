-- 0054_admin_view_as_unblock.sql
-- A 0025 removeu a constraint perfis_admin_cross_condo pra permitir
-- admin_onway assumir um condominio temporariamente (modo view-as).
-- A 0044 (subsindico+conselheiro) recriou a constraint sem perceber e
-- quebrou esse fluxo: 'Administrador OnWay nao pode estar vinculado a
-- um condominio especifico.'
--
-- Fix: dropa a constraint de novo. Admin geral precisa do condominio_id
-- definido temporariamente pra ver o condo assumido.

alter table public.perfis drop constraint if exists perfis_admin_cross_condo;
