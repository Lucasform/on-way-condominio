-- 0052_reacoes_like_dislike.sql
-- Adiciona 'like' e 'dislike' ao check de reacoes (mural).
-- Os antigos 'curtir','amei','aplaudir' seguem aceitos pra compatibilidade.

alter table public.reacoes drop constraint if exists reacoes_tipo_check;
alter table public.reacoes
  add constraint reacoes_tipo_check
  check (tipo in ('curtir','amei','aplaudir','like','dislike'));
