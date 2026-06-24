-- 0104_feedback_resposta.sql
-- Adiciona campo de resposta ao feedback para o admin responder diretamente no kanban.

alter table public.feedback
  add column if not exists resposta text,
  add column if not exists respondido_at timestamptz;
