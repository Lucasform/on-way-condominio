-- 0107_w2_chamado_custo.sql
-- W2: Chamados com custo estimado e aprovação pelo síndico quando custo ≥ limiar.
-- Fluxo: ao criar chamado com custo_estimado >= limiar_aprovacao_chamado do condo →
--        status = 'pendente_aprovacao'; síndico aprova → volta a 'em_andamento'.

-- 1. Novo status em chamados
ALTER TABLE public.chamados
  DROP CONSTRAINT IF EXISTS chamados_status_check;

ALTER TABLE public.chamados
  ADD CONSTRAINT chamados_status_check
  CHECK (status IN (
    'aberto',
    'em_andamento',
    'aguardando',
    'resolvido',
    'cancelado',
    'finalizado',
    'pendente_aprovacao'
  ));

-- 2. Campos de custo e aprovação
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS custo_estimado  numeric(12,2),
  ADD COLUMN IF NOT EXISTS aprovado_por    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em     timestamptz;

-- 3. Limiar configurável por condomínio (default R$ 500)
ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS limiar_aprovacao_chamado numeric(12,2) DEFAULT 500.00;

CREATE INDEX IF NOT EXISTS idx_chamados_pendente ON public.chamados (condominio_id, status)
  WHERE status = 'pendente_aprovacao';
