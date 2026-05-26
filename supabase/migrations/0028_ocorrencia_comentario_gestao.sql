-- 0028_ocorrencia_comentario_gestao.sql
-- Campo livre da gestao na ocorrencia. Editavel pelo sindico/administradora;
-- entra no prompt da IA junto com descricao + local + comentario_extra (transitorio).

alter table public.ocorrencias
  add column if not exists comentario_gestao text;
