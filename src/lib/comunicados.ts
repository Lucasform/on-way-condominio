import { supabase } from './supabase'
import { sendEmail } from './email'
import type { Comunicado, ComunicadoInput, StatusComunicado } from '../types/comunicado'

export async function listComunicados(opts: {
  condominio_id?: string
  status?: StatusComunicado
} = {}): Promise<Comunicado[]> {
  let q = supabase
    .from('comunicados')
    .select('*')
    .order('created_at', { ascending: false })
  if (opts.condominio_id) q = q.eq('condominio_id', opts.condominio_id)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Comunicado[]
}

export async function getComunicado(id: string): Promise<Comunicado | null> {
  const { data, error } = await supabase
    .from('comunicados')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Comunicado | null
}

export async function createComunicado(input: ComunicadoInput): Promise<Comunicado> {
  const { data: userData } = await supabase.auth.getUser()
  const criado_por = userData.user?.id ?? null
  const { data, error } = await supabase
    .from('comunicados')
    .insert({
      condominio_id: input.condominio_id,
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      corpo: input.corpo.trim(),
      modelo_anexo_id: input.modelo_anexo_id ?? null,
      ia_modelo: input.ia_modelo ?? null,
      criado_por,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Comunicado
}

export async function updateComunicado(
  id: string,
  patch: Partial<Pick<Comunicado, 'titulo' | 'corpo' | 'descricao' | 'status'>>,
): Promise<Comunicado> {
  const upd: Record<string, unknown> = {}
  if (patch.titulo !== undefined) upd.titulo = patch.titulo.trim()
  if (patch.corpo !== undefined) upd.corpo = patch.corpo.trim()
  if (patch.descricao !== undefined) upd.descricao = patch.descricao.trim()
  if (patch.status !== undefined) upd.status = patch.status
  const { data, error } = await supabase
    .from('comunicados')
    .update(upd)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Comunicado
}

export async function deleteComunicado(id: string): Promise<void> {
  const { error } = await supabase.from('comunicados').delete().eq('id', id)
  if (error) throw error
}

/**
 * Chama edge `generate-comunicado` que produz {titulo, corpo} a partir
 * da descricao livre + modelo anexo + ai_instrucoes do condominio.
 */
export interface GerarComunicadoOutput {
  titulo: string
  corpo: string
  ia_modelo: string
  modelo_anexo_id: string | null
}

export async function gerarComunicadoIA(input: {
  condominio_id: string
  descricao: string
  titulo_sugerido?: string
}): Promise<GerarComunicadoOutput> {
  const { data, error } = await supabase.functions.invoke('generate-comunicado', {
    body: input,
  })
  if (error) throw error
  if (!data || !data.corpo) {
    throw new Error('Resposta inválida da IA: ' + JSON.stringify(data).slice(0, 200))
  }
  return data as GerarComunicadoOutput
}

/**
 * Envia o comunicado por e-mail pra todos os moradores ativos com e-mail
 * cadastrado, marca como enviado e registra contagem.
 */
export async function enviarComunicadoPorEmail(comunicado: Comunicado): Promise<{ destinatarios: number }> {
  // 1) Coleta e-mails dos moradores ativos
  const { data: pessoas, error: errP } = await supabase
    .from('pessoas')
    .select('email')
    .eq('condominio_id', comunicado.condominio_id)
    .eq('ativo', true)
    .not('email', 'is', null)
  if (errP) throw errP
  const emails = ((pessoas ?? []) as Array<{ email: string | null }>)
    .map((p) => p.email!)
    .filter(Boolean)

  if (emails.length === 0) {
    await supabase
      .from('comunicados')
      .update({ status: 'enviado', enviado_em: new Date().toISOString(), enviado_por_email: true, destinatarios: 0 })
      .eq('id', comunicado.id)
    return { destinatarios: 0 }
  }

  // 2) Busca nome do condo pro header do email
  const { data: condo } = await supabase
    .from('condominios')
    .select('nome')
    .eq('id', comunicado.condominio_id)
    .maybeSingle()

  // 3) Renderiza HTML simples a partir do corpo final
  const corpoHtml = comunicado.corpo
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

  await sendEmail({
    to: emails,
    template: 'custom',
    condominio_id: comunicado.condominio_id,
    vars: { condominio_nome: condo?.nome ?? undefined },
    custom: {
      subject: comunicado.titulo || 'Comunicado do condomínio',
      html: corpoHtml,
    },
  })

  await supabase
    .from('comunicados')
    .update({
      status: 'enviado',
      enviado_em: new Date().toISOString(),
      enviado_por_email: true,
      destinatarios: emails.length,
    })
    .eq('id', comunicado.id)
  return { destinatarios: emails.length }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
