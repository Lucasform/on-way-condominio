-- 0070_ajustar_crons.sql
-- Ajustes pedidos pelo síndico/admin (não financeiro, não pet, não votação a cada hora):
--   manter:    notify-eventos-amanha (08h diário), notify-votacoes (a cada 30min, janela 2h)
--   alterar:   notify-encomendas-paradas → a cada 2h (em vez de 12h diário)
--              cron-assembleia-lembretes → 08h diário (em vez de 10h)
--   desagendar: cron-auditoria-retencao, cron-multa-vencimentos,
--               cron-pet-vacina-lembretes, cron-votacao-eventos
--
-- As edges continuam deployadas — podem ser chamadas manualmente quando precisar.

-- Desagenda os 4 cancelados (+ os antigos que serão reagendados)
do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in (
    'onway_cron_auditoria_retencao',
    'onway_cron_multa_vencimentos',
    'onway_cron_pet_vacina_lembretes',
    'onway_cron_votacao_eventos',
    'onway_notify_encomendas_paradas',
    'onway_notify_votacoes',
    'onway_cron_assembleia_lembretes'
  );
exception when others then null;
end $$;

-- Reagenda os mantidos com cadência nova
select cron.schedule(
  'onway_notify_encomendas_paradas',
  '0 */2 * * *',
  $$select public.invocar_edge_function('notify-encomendas-paradas');$$
);

select cron.schedule(
  'onway_notify_votacoes',
  '*/30 * * * *',
  $$select public.invocar_edge_function('notify-votacoes');$$
);

select cron.schedule(
  'onway_cron_assembleia_lembretes',
  '0 8 * * *',
  $$select public.invocar_edge_function('cron-assembleia-lembretes');$$
);
