-- 0106_w1_multa_sod.sql
-- W1: Segregação de função (SoD) em multas.
-- Quem registra a multa (criado_por) não pode ser a mesma pessoa que a aprova.
-- Fluxo: pendente_aprovacao → em_analise → aplicada → paga/contestada/cancelada/arquivada

-- 1. Ampliar constraint de status para incluir pendente_aprovacao
ALTER TABLE public.multas
  DROP CONSTRAINT IF EXISTS multas_status_check;

ALTER TABLE public.multas
  ADD CONSTRAINT multas_status_check
  CHECK (status IN (
    'pendente_aprovacao',
    'em_analise',
    'aplicada',
    'paga',
    'contestada',
    'cancelada',
    'arquivada'
  ));

-- 2. Rastrear quem criou (para enforçar SoD no frontend)
ALTER TABLE public.multas
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: multas existentes assumem criado_por = aplicada_por
UPDATE public.multas
SET    criado_por = aplicada_por
WHERE  criado_por IS NULL AND aplicada_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_multas_criado_por ON public.multas (criado_por);
