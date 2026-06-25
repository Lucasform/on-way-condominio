-- 0105_parceiro_role.sql
-- Suporte ao perfil "Parceiro OnWay": gestor externo de múltiplos condomínios.
-- Criado exclusivamente via convite de plataforma gerado pelo admin_onway.

-- ── 1. Adicionar 'parceiro' ao enum de roles (se ainda não existe) ────────────
DO $$
BEGIN
  ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'parceiro' BEFORE 'admin';
EXCEPTION WHEN others THEN NULL; END
$$;

-- Se o projeto usa check-constraint em vez de enum, ajuste aqui:
ALTER TABLE perfis DROP CONSTRAINT IF EXISTS perfis_role_check;
ALTER TABLE perfis ADD CONSTRAINT perfis_role_check CHECK (
  role IN (
    'admin_onway','parceiro','admin','administradora',
    'sindico','subsindico','conselheiro','portaria','ronda','morador'
  )
);

-- ── 2. Tabela de convites de plataforma (apenas admin_onway cria) ─────────────
CREATE TABLE IF NOT EXISTS convites_plataforma (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text UNIQUE NOT NULL,
  role            text NOT NULL DEFAULT 'parceiro',
  nome_destinatario text,
  criado_por      uuid REFERENCES perfis(id) ON DELETE SET NULL,
  usos            int NOT NULL DEFAULT 0,
  usos_max        int NOT NULL DEFAULT 1,
  expira_em       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revogado        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE convites_plataforma ENABLE ROW LEVEL SECURITY;

-- Apenas admin_onway pode ler/escrever
CREATE POLICY "plataforma_admin_onway_all" ON convites_plataforma
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM perfis WHERE id = auth.uid()) = 'admin_onway'
  )
  WITH CHECK (
    (SELECT role FROM perfis WHERE id = auth.uid()) = 'admin_onway'
  );

-- ── 3. perfis_condominios (se ainda não existir) ──────────────────────────────
-- Permite que parceiro (e futuramente outros) pertençam a múltiplos condomínios.
CREATE TABLE IF NOT EXISTS perfis_condominios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  condominio_id   uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'admin',
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(perfil_id, condominio_id)
);

ALTER TABLE perfis_condominios ENABLE ROW LEVEL SECURITY;

-- admin_onway gerencia tudo
CREATE POLICY "pc_admin_onway" ON perfis_condominios
  FOR ALL TO authenticated
  USING ((SELECT role FROM perfis WHERE id = auth.uid()) = 'admin_onway')
  WITH CHECK ((SELECT role FROM perfis WHERE id = auth.uid()) = 'admin_onway');

-- parceiro lê seus próprios vínculos
CREATE POLICY "pc_parceiro_read" ON perfis_condominios
  FOR SELECT TO authenticated
  USING (perfil_id = auth.uid());

-- ── 4. RPC set_active_condominio (se ainda não existir) ──────────────────────
-- Atualiza perfis.condominio_id para troca de contexto do parceiro.
CREATE OR REPLACE FUNCTION set_active_condominio(p_condominio uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Garante que o parceiro está vinculado ao condomínio alvo
  IF (SELECT role FROM perfis WHERE id = auth.uid()) = 'parceiro' THEN
    IF NOT EXISTS (
      SELECT 1 FROM perfis_condominios
      WHERE perfil_id = auth.uid() AND condominio_id = p_condominio AND ativo = true
    ) THEN
      RAISE EXCEPTION 'Condomínio não autorizado para este perfil.';
    END IF;
  END IF;
  UPDATE perfis SET condominio_id = p_condominio WHERE id = auth.uid();
END;
$$;
