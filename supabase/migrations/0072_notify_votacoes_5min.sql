-- 0072_notify_votacoes_5min.sql
-- notify-votacoes: polling a cada 5min.
-- Justificativa da prática:
--   A função filtra votações com data_fim entre now() e now()+2h (janela de aviso)
--   e marca push_encerramento_at após disparar. Como o cron roda a cada 5min e a
--   janela é de 2h, a PRIMEIRA passada dentro da janela dispara o push — o que
--   resulta em aviso sempre entre 1h55min e 2h00min antes do fim. Idempotência
--   por flag garante que cada votação só recebe 1 push de encerramento.
--   Mesma precisão vale pra abertura (data_inicio <= now()).
--
-- Esse padrão (polling + janela + idempotência) é o jeito profissional de fazer
-- "notificar X tempo antes de Y" sem trazer fila de jobs externa.

do $$
begin
  perform cron.unschedule('onway_notify_votacoes');
exception when others then null;
end $$;

select cron.schedule(
  'onway_notify_votacoes',
  '*/5 * * * *',
  $$select public.invocar_edge_function('notify-votacoes');$$
);
