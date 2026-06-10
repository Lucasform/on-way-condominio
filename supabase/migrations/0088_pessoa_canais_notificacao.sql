-- 0088: preferência de canais de notificação por pessoa (opt-out do morador).
-- Aditivo e seguro: default com todos os canais ligados preserva o comportamento
-- atual (todos os moradores existentes continuam recebendo por todos os canais).

alter table public.pessoas
  add column if not exists canais_notificacao jsonb not null
  default '{"email": true, "whatsapp": true, "push": true}'::jsonb;

comment on column public.pessoas.canais_notificacao is
  'Preferência de canais do morador (opt-out). {email,whatsapp,push}. In-app/sininho sempre.';
