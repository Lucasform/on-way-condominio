-- 0033: novo status `finalizado` em chamados.
-- Sequência natural: aberto -> em_andamento -> aguardando -> resolvido -> finalizado
-- "Resolvido" indica que o reparo foi feito; "finalizado" encerra o chamado de vez.

alter table public.chamados
  drop constraint if exists chamados_status_check;

alter table public.chamados
  add constraint chamados_status_check
  check (status in (
    'aberto',
    'em_andamento',
    'aguardando',
    'resolvido',
    'finalizado',
    'cancelado'
  ));
