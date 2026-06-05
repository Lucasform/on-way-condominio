-- 0086_notificacao_fluxo.sql
-- Redesenho do fluxo: ocorrência → NOTIFICAÇÃO (passo 1) → decisão (multa /
-- advertência / arquivar / cancelar). Advertência é desfecho da notificação
-- (status terminal, sem valor). 'contestada' fica disponível pra quando a
-- unidade contestar (UI do morador vem em leva à parte).

alter table public.notificacoes drop constraint if exists notificacoes_status_check;
alter table public.notificacoes
  add constraint notificacoes_status_check check (status in (
    'pendente','enviada','ciente','contestada','advertencia','multa_gerada','arquivada','cancelada'
  ));

-- vínculo opcional pra multa gerada a partir da notificação
alter table public.notificacoes
  add column if not exists multa_id uuid references public.multas(id) on delete set null;
