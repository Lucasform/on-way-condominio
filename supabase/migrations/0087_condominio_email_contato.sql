-- 0087_condominio_email_contato.sql
-- E-mail de contato do condomínio: usado como Reply-To nos envios (FROM real
-- por condomínio é inviável sem verificar o domínio de cada um no Resend).
alter table public.condominios
  add column if not exists email_contato text;
