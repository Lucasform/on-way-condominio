-- 0069_agendar_crons_restantes.sql
-- Agenda os 5 crons que estavam deployados mas sem schedule no pg_cron:
--   cron-assembleia-lembretes   (diário 10h UTC)
--   cron-auditoria-retencao     (mensal dia 1, 03h UTC)
--   cron-multa-vencimentos      (diário 09h UTC)
--   cron-pet-vacina-lembretes   (diário 11h UTC)
--   cron-votacao-eventos        (a cada hora :15)
--
-- Reusa helper public.invocar_edge_function() criado em 0064.

do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in (
    'onway_cron_assembleia_lembretes',
    'onway_cron_auditoria_retencao',
    'onway_cron_multa_vencimentos',
    'onway_cron_pet_vacina_lembretes',
    'onway_cron_votacao_eventos'
  );
exception when others then null;
end $$;

select cron.schedule(
  'onway_cron_assembleia_lembretes',
  '0 10 * * *',
  $$select public.invocar_edge_function('cron-assembleia-lembretes');$$
);

select cron.schedule(
  'onway_cron_auditoria_retencao',
  '0 3 1 * *',
  $$select public.invocar_edge_function('cron-auditoria-retencao');$$
);

select cron.schedule(
  'onway_cron_multa_vencimentos',
  '0 9 * * *',
  $$select public.invocar_edge_function('cron-multa-vencimentos');$$
);

select cron.schedule(
  'onway_cron_pet_vacina_lembretes',
  '0 11 * * *',
  $$select public.invocar_edge_function('cron-pet-vacina-lembretes');$$
);

select cron.schedule(
  'onway_cron_votacao_eventos',
  '15 * * * *',
  $$select public.invocar_edge_function('cron-votacao-eventos');$$
);
