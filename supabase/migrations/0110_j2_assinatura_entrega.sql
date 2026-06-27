-- 0110_j2_assinatura_entrega.sql
-- J2: Assinatura digital na entrega de encomenda (canvas touch → PNG no Storage).

ALTER TABLE public.encomendas
  ADD COLUMN IF NOT EXISTS assinatura_url text,
  ADD COLUMN IF NOT EXISTS assinado_em    timestamptz;

-- Bucket privado para imagens de assinatura
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assinaturas-entrega',
  'assinaturas-entrega',
  false,
  524288,    -- 512 KB máximo por assinatura
  ARRAY['image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Portaria e staff podem salvar assinaturas
CREATE POLICY "assinaturas_entrega_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assinaturas-entrega'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "assinaturas_entrega_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assinaturas-entrega');

CREATE POLICY "assinaturas_entrega_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'assinaturas-entrega');
