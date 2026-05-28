-- 0071_notify_votacoes_1h.sql
-- notify-votacoes: cron a cada 1h (polling), não 30min.
-- IMPORTANTE: a frequência aqui é só verificação. O morador recebe 1 push na
-- abertura e 1 push 2h antes do fim (idempotente via push_abertura_at /
-- push_encerramento_at). Não é "push a cada hora".

do $$
begin
  perform cron.unschedule('onway_notify_votacoes');
exception when others then null;
end $$;

select cron.schedule(
  'onway_notify_votacoes',
  '0 * * * *',
  $$select public.invocar_edge_function('notify-votacoes');$$
);
