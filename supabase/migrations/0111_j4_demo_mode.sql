-- 0111_j4_demo_mode.sql
-- J4: Flag de modo demonstração por condomínio.
-- Quando is_demo=true, o app exibe banner informativo e pode usar dados fictícios.

ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Função pública para verificar se condo é demo (usada em landing/cadastro)
CREATE OR REPLACE FUNCTION public.is_demo_condo(p_condominio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_demo, false) FROM public.condominios WHERE id = p_condominio_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_condo(uuid) TO authenticated;
