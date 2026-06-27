-- 0109_j1_campos_customizados.sql
-- J1: Campos personalizáveis por condomínio.
-- O síndico define um schema de campos extras (nome, tipo, obrigatório) por entidade.
-- Os valores ficam em JSONB campos_extras na própria tabela de negócio.

-- 1. Colunas campos_extras em tabelas de negócio
ALTER TABLE public.unidades    ADD COLUMN IF NOT EXISTS campos_extras jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.ocorrencias ADD COLUMN IF NOT EXISTS campos_extras jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.chamados    ADD COLUMN IF NOT EXISTS campos_extras jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.pessoas     ADD COLUMN IF NOT EXISTS campos_extras jsonb NOT NULL DEFAULT '{}';

-- 2. Tabela de definição dos campos customizados por condo + entidade
CREATE TABLE IF NOT EXISTS public.campos_customizados (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  entidade      text NOT NULL CHECK (entidade IN ('unidade','ocorrencia','chamado','pessoa')),
  nome          text NOT NULL,          -- slug interno: ex. 'numero_fracao'
  label         text NOT NULL,          -- rótulo visível: ex. 'Fração ideal'
  tipo          text NOT NULL DEFAULT 'text'
                CHECK (tipo IN ('text','number','boolean','date','select')),
  opcoes        text[],                 -- só para tipo='select'
  obrigatorio   boolean NOT NULL DEFAULT false,
  ordem         int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (condominio_id, entidade, nome)
);

ALTER TABLE public.campos_customizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campos_customizados FORCE ROW LEVEL SECURITY;

CREATE POLICY campos_customizados_select ON public.campos_customizados
  FOR SELECT TO authenticated
  USING (
    public.is_admin_onway()
    OR condominio_id IN (SELECT public.user_condominios())
  );

CREATE POLICY campos_customizados_manage ON public.campos_customizados
  FOR ALL TO authenticated
  USING (
    public.is_admin_onway()
    OR (
      condominio_id IN (SELECT public.user_condominios())
      AND public.user_role_in(condominio_id) IN ('administradora','sindico')
    )
  )
  WITH CHECK (
    public.is_admin_onway()
    OR (
      condominio_id IN (SELECT public.user_condominios())
      AND public.user_role_in(condominio_id) IN ('administradora','sindico')
    )
  );

CREATE INDEX IF NOT EXISTS idx_campos_customizados_condo_entidade
  ON public.campos_customizados (condominio_id, entidade, ordem);
