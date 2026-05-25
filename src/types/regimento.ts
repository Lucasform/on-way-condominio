export interface RegimentoArtigo {
  id: string
  condominio_id: string
  numero: string | null
  titulo: string
  conteudo: string
  ordem: number
  ativo: boolean
  embedding_atualizado_em: string | null
  created_at: string
  updated_at: string
}

export type RegimentoArtigoInput = Omit<
  RegimentoArtigo,
  'id' | 'ativo' | 'embedding_atualizado_em' | 'created_at' | 'updated_at'
>
