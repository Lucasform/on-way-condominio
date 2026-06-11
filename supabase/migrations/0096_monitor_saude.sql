-- 0096: agenda o monitor de saúde (edge monitor-saude) — diário 12h UTC (09h BRT).
-- Verifica falhas reais (e-mails, fila de envio, análise IA) e avisa o admin OnWay.

select cron.schedule(
  'onway_monitor_saude',
  '0 12 * * *',
  $$ select public.invocar_edge_function('monitor-saude'); $$
);
