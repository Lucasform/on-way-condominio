import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getAssembleia,
  deleteAssembleia,
  uploadAta,
  getAtaSignedUrl,
  removeAta,
} from '../lib/assembleias'
import { listVotacoes } from '../lib/votacoes'
import { supabase } from '../lib/supabase'
import type { Assembleia, StatusAssembleia, TipoAssembleia } from '../types/assembleia'
import type { Votacao } from '../types/votacao'
import { useAuth } from '../components/AuthProvider'
import { isStaff, isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'

const STATUS_LABEL: Record<StatusAssembleia, string> = {
  planejada: 'Planejada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<StatusAssembleia, string> = {
  planejada: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  realizada: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  cancelada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

const TIPO_LABEL: Record<TipoAssembleia, string> = {
  ordinaria: 'Assembleia Geral Ordinária',
  extraordinaria: 'Assembleia Geral Extraordinária',
}

const VOT_STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

export default function AssembleiaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()

  const [assembleia, setAssembleia] = useState<Assembleia | null>(null)
  const [votacoes, setVotacoes] = useState<Votacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  const canEdit = isStaff(perfil?.role)
  const canDelete = isGestor(perfil?.role)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const a = await getAssembleia(id)
      if (!a) {
        setError('Assembleia não encontrada.')
        return
      }
      setAssembleia(a)
      const vs = await listVotacoes({ assembleia_id: a.id })
      setVotacoes(vs)
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

  async function handleUploadAta(file: File) {
    if (!assembleia) return
    setUploading(true)
    try {
      // se ja tinha ata, remove a antiga
      if (assembleia.ata_url) await removeAta(assembleia.ata_url).catch(() => {})
      const path = await uploadAta(file, assembleia.condominio_id, assembleia.id)
      await supabase.from('assembleias').update({ ata_url: path }).eq('id', assembleia.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao subir ata.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!assembleia) return
    if (!window.confirm('Apagar esta assembleia definitivamente? Esta ação não pode ser desfeita.')) return
    setBusy(true)
    try {
      if (assembleia.ata_url) await removeAta(assembleia.ata_url).catch(() => {})
      await deleteAssembleia(assembleia.id)
      navigate('/assembleias')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao apagar.')
      setBusy(false)
    }
  }

  async function handleRemoverAta() {
    if (!assembleia?.ata_url) return
    if (!window.confirm('Remover o PDF da ata?')) return
    setBusy(true)
    try {
      await removeAta(assembleia.ata_url)
      await supabase.from('assembleias').update({ ata_url: null }).eq('id', assembleia.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao remover.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAbrirAta() {
    if (!assembleia?.ata_url) return
    try {
      const url = await getAtaSignedUrl(assembleia.ata_url, 600)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao abrir ata.')
    }
  }

  if (loading) return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>

  if (error || !assembleia) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader
          title="Assembleia"
          actions={<Link to="/assembleias"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title={assembleia.titulo}
        subtitle={TIPO_LABEL[assembleia.tipo]}
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={busy} />
            )}
            {canEdit && (
              <Link to={`/assembleias/${assembleia.id}/editar`}>
                <Button variant="secondary">Editar</Button>
              </Link>
            )}
            <Link to="/assembleias"><Button variant="ghost">← Voltar</Button></Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="text-sm text-slate-300">
            <div><span className="text-slate-500">Quando:</span> {new Date(assembleia.data_assembleia).toLocaleString('pt-BR')}</div>
            {assembleia.local && (
              <div className="mt-0.5"><span className="text-slate-500">Onde:</span> {assembleia.local}</div>
            )}
          </div>
          <span className={`shrink-0 px-3 py-1 rounded text-sm border ${STATUS_CLASS[assembleia.status]}`}>
            {STATUS_LABEL[assembleia.status]}
          </span>
        </div>

        {assembleia.pauta && (
          <div className="mt-4 border-t border-slate-800 pt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Pauta</div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{assembleia.pauta}</p>
          </div>
        )}

        {assembleia.observacoes && (
          <div className="mt-4 border-t border-slate-800 pt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Observações</div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{assembleia.observacoes}</p>
          </div>
        )}
      </div>

      {/* Ata */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-100">Ata</h3>
          {canEdit && assembleia.ata_url && (
            <button
              onClick={handleRemoverAta}
              disabled={busy}
              className="text-xs text-slate-500 hover:text-red-400 transition"
            >
              Remover
            </button>
          )}
        </div>

        {assembleia.ata_url ? (
          <button
            onClick={handleAbrirAta}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 transition"
          >
            📄 Abrir PDF da ata
          </button>
        ) : (
          <div className="text-sm text-slate-500">Nenhuma ata anexada ainda.</div>
        )}

        {canEdit && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <span className="px-3 py-1.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-xs font-medium">
                {assembleia.ata_url ? 'Substituir ata' : '+ Anexar ata (PDF)'}
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUploadAta(f)
                }}
              />
              {uploading && <span className="text-xs text-slate-500">Enviando...</span>}
            </label>
          </div>
        )}
      </div>

      {/* Votações relacionadas */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-100">Votações desta assembleia</h3>
          {canEdit && (
            <Link
              to={`/votacoes/nova?assembleia=${assembleia.id}`}
              className="text-xs text-brand-400 hover:underline"
            >
              + Nova votação
            </Link>
          )}
        </div>

        {votacoes.length === 0 ? (
          <div className="text-sm text-slate-500">
            Nenhuma votação vinculada a esta assembleia.
          </div>
        ) : (
          <ul className="space-y-2">
            {votacoes.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/votacoes/${v.id}`}
                  className="block rounded-md border border-slate-800 hover:border-slate-700 px-3 py-2 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-100 truncate">{v.titulo}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(v.data_inicio).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{VOT_STATUS_LABEL[v.status] ?? v.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
