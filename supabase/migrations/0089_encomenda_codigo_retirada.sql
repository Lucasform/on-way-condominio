-- 0089: código de retirada da encomenda (confirmação na portaria).
-- Aditivo: encomendas antigas ficam com null e seguem o fluxo de baixa atual.
-- O código é gerado no app na criação e enviado ao morador nos avisos.

alter table public.encomendas
  add column if not exists codigo_retirada text;

comment on column public.encomendas.codigo_retirada is
  'Código (4 díg.) que o morador informa na portaria pra confirmar a retirada. Null = sem código.';
