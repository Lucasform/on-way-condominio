-- 0108_i3_condo_feature_overrides.sql
-- I3: Feature flags por condomínio (síndico/administradora ativa/desativa módulos).
-- Sobrescreve a flag global apenas para aquele condo.

CREATE TABLE IF NOT EXISTS public.condo_feature_overrides (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  key           text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  updated_at    timestamptz DEFAULT now(),
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (condominio_id, key)
);

ALTER TABLE public.condo_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condo_feature_overrides FORCE ROW LEVEL SECURITY;

-- Leitura: admin_onway + qualquer membro do condo
CREATE POLICY condo_feature_overrides_select ON public.condo_feature_overrides
  FOR SELECT TO authenticated
  USING (
    public.is_admin_onway()
    OR condominio_id IN (SELECT public.user_condominios())
  );

-- Escrita: admin_onway + síndico/administradora do condo
CREATE POLICY condo_feature_overrides_write ON public.condo_feature_overrides
  FOR ALL TO authenticated
  USING (
    public.is_admin_onway()
    OR (
      condominio_id IN (SELECT public.user_condominios())
      AND public.user_role_in(condominio_id) IN ('administradora', 'sindico')
    )
  )
  WITH CHECK (
    public.is_admin_onway()
    OR (
      condominio_id IN (SELECT public.user_condominios())
      AND public.user_role_in(condominio_id) IN ('administradora', 'sindico')
    )
  );

CREATE INDEX IF NOT EXISTS idx_condo_feature_overrides_condo
  ON public.condo_feature_overrides (condominio_id);
