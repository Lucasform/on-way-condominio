import { supabase } from './supabase'

export type TemplateTipo = 'chat' | 'email' | 'whatsapp'

export interface MensagemTemplate {
  id: string
  condominio_id: string
  tipo: TemplateTipo
  titulo: string
  corpo: string
  assunto: string | null
  ativo: boolean
  criado_por: string | null
  created_at: string
  updated_at: string
}

export interface MensagemTemplateInput {
  condominio_id: string
  tipo: TemplateTipo
  titulo: string
  corpo: string
  assunto?: string | null
}

const SELECT = 'id, condominio_id, tipo, titulo, corpo, assunto, ativo, criado_por, created_at, updated_at'

export async function listTemplates(opts: {
  condominio_id?: string
  tipo?: TemplateTipo | TemplateTipo[]
  apenas_ativos?: boolean
} = {}): Promise<MensagemTemplate[]> {
  let q = supabase.from('mensagem_templates').select(SELECT).order('titulo')
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (Array.isArray(opts.tipo)) q = q.in('tipo', opts.tipo)
  else if (opts.tipo) q = q.eq('tipo', opts.tipo)
  if (opts.apenas_ativos !== false) q = q.eq('ativo', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as MensagemTemplate[]
}

export async function createTemplate(input: MensagemTemplateInput, userId?: string): Promise<MensagemTemplate> {
  const { data, error } = await supabase
    .from('mensagem_templates')
    .insert({ ...input, criado_por: userId ?? null })
    .select(SELECT)
    .single()
  if (error) throw error
  return data as MensagemTemplate
}

export async function updateTemplate(id: string, input: Partial<MensagemTemplateInput>): Promise<MensagemTemplate> {
  const { data, error } = await supabase
    .from('mensagem_templates')
    .update(input)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return data as MensagemTemplate
}

export async function setTemplateAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('mensagem_templates').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('mensagem_templates').delete().eq('id', id)
  if (error) throw error
}
