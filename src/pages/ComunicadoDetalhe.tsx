import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import {
  deleteComunicado,
  enviarComunicadoPorEmail,
  getComunicado,
  updateComunicado,
} from '../lib/comunicados'
import { getCondominio } from '../lib/condominios'
import { gerarPdfComunicado } from '../lib/comunicadoPdf'
import { isGestor } from '../lib/permissions'
import type { Comunicado, StatusComunicado } from '../types/comunicado'
import type { Condominio } from '../types/condominio'
import type { Perfil } from '../types/database'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { TextArea, TextInput, Field } from '../components/ui/Input'

const STATUS_LABEL: Record<StatusComunicado, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  arquivado: 'Arquivado',
}

const STATUS_CLASS: Record<StatusComunicado, string> = {
  rascunho: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  enviado: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  arquivado: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

export default function ComunicadoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const gestor = isGestor(perfil?.role)
  const toast = useToast()
  const confirm = useConfirm()

  const [comunicado, setComunicado] = useState<Comunicado | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [editando, setEditando] = useState(false)
  const [editTitulo, setEditTitulo] = useState('')
  const [editCorpo, setEditCorpo] = useState('')

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const c = await getComunicado(id)
      if (!c) {
        setError('Comunicado não encontrado.')
        setLoading(false)
        return
      }
      setComunicado(c)
      setEditTitulo(c.titulo)
      setEditCorpo(c.corpo)
      const co = await getCondominio(c.condominio_id)
      setCondominio(co)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSalvar() {
    if (!comunicado) return
    setWorking(true)
    try {
      const updated = await updateComunicado(comunicado.id, {
        titulo: editTitulo,
        corpo: editCorpo,
      })
      setComunicado(updated)
      setEditando(false)
      toast.success('Salvo.')
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : '')
    } finally {
      setWorking(false)
    }
  }

  async function handlePdf() {
    if (!comunicado || !condominio) return
    setWorking(true)
    try {
      // Busca assinatura digital do user logado pra rodapé
      let assinaturaUrl: string | null = null
      let emissorNome: string | null = null
      if (user) {
        const { data: p } = await supabase
          .from('perfis')
          .select('assinatura_url, nome_exibicao')
          .eq('id', user.id)
          .maybeSingle<Pick<Perfil, 'assinatura_url' | 'nome_exibicao'>>()
        assinaturaUrl = p?.assinatura_url ?? null
        emissorNome = p?.nome_exibicao ?? null
      }
      await gerarPdfComunicado({
        comunicado,
        condominio,
        assinaturaUrl,
        emissorNome,
      })
    } catch (e) {
      toast.error('Erro ao gerar PDF', e instanceof Error ? e.message : '')
    } finally {
      setWorking(false)
    }
  }

  async function handleEnviar() {
    if (!comunicado) return
    const ok = await confirm({
      title: 'Enviar comunicado',
      message: 'Enviar este comunicado por e-mail para todos os moradores ativos?',
      confirmText: 'Enviar',
    })
    if (!ok) return
    setWorking(true)
    try {
      const r = await enviarComunicadoPorEmail(comunicado)
      toast.success(`Enviado para ${r.destinatarios} destinatários.`)
      await load()
    } catch (e) {
      toast.error('Erro ao enviar', e instanceof Error ? e.message : '')
    } finally {
      setWorking(false)
    }
  }

  async function handleArquivar() {
    if (!comunicado) return
    const ok = await confirm({ message: 'Arquivar este comunicado?' })
    if (!ok) return
    setWorking(true)
    try {
      const updated = await updateComunicado(comunicado.id, { status: 'arquivado' })
      setComunicado(updated)
      toast.success('Arquivado.')
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete() {
    if (!comunicado) return
    const ok = await confirm({
      title: 'Excluir comunicado',
      message: 'Apagar este comunicado DEFINITIVAMENTE?',
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    setWorking(true)
    try {
      await deleteComunicado(comunicado.id)
      toast.success('Comunicado excluído.')
      navigate('/comunicados')
    } catch (e) {
      toast.error('Erro ao excluir', e instanceof Error ? e.message : '')
      setWorking(false)
    }
  }

  if (loading) {
    return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>
  }

  if (error || !comunicado) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader
          title="Comunicado"
          actions={
            <Link to="/comunicados">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          }
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrado.'}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Comunicado"
        actions={
          <div className="flex items-center gap-2">
            {gestor && <DeleteButton onClick={handleDelete} disabled={working} />}
            <Link to="/comunicados">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-400">
            {new Date(comunicado.created_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[comunicado.status]}`}>
            {STATUS_LABEL[comunicado.status]}
          </span>
        </div>

        {!editando ? (
          <>
            <h2 className="text-xl font-semibold text-slate-100">{comunicado.titulo}</h2>
            <div className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed">
              {comunicado.corpo}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <Field label="Título">
              <TextInput value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
            </Field>
            <Field label="Corpo">
              <TextArea value={editCorpo} onChange={(e) => setEditCorpo(e.target.value)} rows={12} />
            </Field>
            <div className="flex gap-2">
              <Button onClick={handleSalvar} disabled={working}>
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => { setEditando(false); setEditTitulo(comunicado.titulo); setEditCorpo(comunicado.corpo) }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {gestor && comunicado.status !== 'arquivado' && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-200 mb-3">Ações</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePdf} disabled={working}>📄 Baixar PDF</Button>
            {!editando && (
              <Button variant="ghost" onClick={() => setEditando(true)} disabled={working}>
                ✎ Editar texto
              </Button>
            )}
            {comunicado.status === 'rascunho' && (
              <Button onClick={handleEnviar} disabled={working}>
                ✉ Enviar por e-mail
              </Button>
            )}
            {comunicado.status === 'enviado' && (
              <Button variant="ghost" onClick={handleArquivar} disabled={working}>
                📦 Arquivar
              </Button>
            )}
          </div>
          {comunicado.descricao && (
            <details className="mt-4 text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-slate-300">
                Ver descrição original (rascunho do gestor)
              </summary>
              <p className="mt-2 whitespace-pre-wrap italic">{comunicado.descricao}</p>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
