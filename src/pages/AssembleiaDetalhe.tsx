import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getAssembleia,
  deleteAssembleia,
  uploadAta,
  getAtaSignedUrl,
  removeAta,
  listPresencas,
  confirmarPresenca,
  cancelarPresenca,
  marcarPresente,
  updateMesaDiretora,
  uploadAssinaturaMesa,
} from '../lib/assembleias'
import type { AssembleiaPresenca, MesaMembro, CargoMesa } from '../types/assembleia'
import { listVotacoes } from '../lib/votacoes'
import { supabase } from '../lib/supabase'
import { resolveNomesUsuarios } from '../lib/nomes'
import type { Assembleia, StatusAssembleia, TipoAssembleia } from '../types/assembleia'
import type { Votacao } from '../types/votacao'
import { useAuth } from '../components/AuthProvider'
import { isStaff, isGestor } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { DetailSkeleton } from '../components/ui/Skeleton'
import DeleteButton from '../components/ui/DeleteButton'
import { removeWhiteBackground } from '../lib/removeBackground'

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
  const { user, perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [assembleia, setAssembleia] = useState<Assembleia | null>(null)
  const [votacoes, setVotacoes] = useState<Votacao[]>([])
  const [presencas, setPresencas] = useState<AssembleiaPresenca[]>([])
  const [nomesPresenca, setNomesPresenca] = useState<Record<string, string>>({})
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
      const [vs, ps] = await Promise.all([
        listVotacoes({ assembleia_id: a.id }),
        listPresencas(a.id).catch(() => [] as AssembleiaPresenca[]),
      ])
      setVotacoes(vs)
      setPresencas(ps)
      resolveNomesUsuarios(ps.map((p) => p.user_id))
        .then(setNomesPresenca)
        .catch(() => {})
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
      toast.error('Erro ao subir ata', e instanceof Error ? e.message : '')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!assembleia) return
    const ok = await confirm({
      title: 'Apagar assembleia',
      message: 'Apagar esta assembleia definitivamente? Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Apagar',
    })
    if (!ok) return
    setBusy(true)
    try {
      if (assembleia.ata_url) await removeAta(assembleia.ata_url).catch(() => {})
      await deleteAssembleia(assembleia.id)
      toast.success('Assembleia apagada.')
      navigate('/assembleias')
    } catch (e) {
      toast.error('Erro ao apagar', e instanceof Error ? e.message : '')
      setBusy(false)
    }
  }

  async function handleRemoverAta() {
    if (!assembleia?.ata_url) return
    const ok = await confirm({ message: 'Remover o PDF da ata?', tone: 'danger', confirmText: 'Remover' })
    if (!ok) return
    setBusy(true)
    try {
      await removeAta(assembleia.ata_url)
      await supabase.from('assembleias').update({ ata_url: null }).eq('id', assembleia.id)
      await load()
      toast.success('Ata removida.')
    } catch (e) {
      toast.error('Erro ao remover', e instanceof Error ? e.message : '')
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
      toast.error('Erro ao abrir ata', e instanceof Error ? e.message : '')
    }
  }

  async function handleTogglePresenca() {
    if (!assembleia || !user) return
    setBusy(true)
    try {
      const ja = presencas.some((p) => p.user_id === user.id)
      if (ja) await cancelarPresenca(assembleia.id, user.id)
      else await confirmarPresenca(assembleia.id, user.id)
      await load()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckIn(presenca_id: string) {
    setBusy(true)
    try {
      await marcarPresente(presenca_id)
      await load()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <DetailSkeleton />

  if (error || !assembleia) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
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
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
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

      {/* Presenças */}
      <PresencasCard
        presencas={presencas}
        nomes={nomesPresenca}
        userId={user?.id ?? null}
        canManage={canEdit}
        onToggle={handleTogglePresenca}
        onCheckIn={handleCheckIn}
        busy={busy}
      />

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

      {/* Mesa diretora */}
      {(canEdit || (assembleia.mesa_diretora ?? []).length > 0) && (
        <MesaDiretoraCard
          assembleia={assembleia}
          canEdit={canEdit}
          onUpdate={load}
          toast={toast}
        />
      )}

      {/* Votacoes relacionadas */}
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

const CARGO_OPTS: { value: CargoMesa; label: string }[] = [
  { value: 'presidente_mesa', label: 'Presidente da Mesa' },
  { value: 'secretario', label: 'Secretário(a)' },
  { value: 'coordenador', label: 'Coordenador(a) da Assembleia' },
  { value: 'outro', label: 'Outro' },
]

const CARGO_LABEL: Record<CargoMesa, string> = {
  presidente_mesa: 'Presidente da Mesa',
  secretario: 'Secretário(a)',
  coordenador: 'Coordenador(a) da Assembleia',
  outro: 'Outro',
}

function MesaDiretoraCard({
  assembleia, canEdit, onUpdate, toast,
}: {
  assembleia: import('../types/assembleia').Assembleia
  canEdit: boolean
  onUpdate: () => void
  toast: ReturnType<typeof import('../components/ui/Toast').useToast>
}) {
  const [mesa, setMesa] = useState<MesaMembro[]>(assembleia.mesa_diretora ?? [])
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoCargo, setNovoCargo] = useState<CargoMesa>('presidente_mesa')
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ idx: number; original: string; processed: string; file: File } | null>(null)
  const [processing, setProcessing] = useState(false)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  async function openPreview(idx: number, rawFile: File) {
    setProcessing(true)
    try {
      const originalUrl = URL.createObjectURL(rawFile)
      const { file: processedFile, previewUrl } = await removeWhiteBackground(rawFile)
      setPreview({ idx, original: originalUrl, processed: previewUrl, file: processedFile })
    } catch {
      // Fallback: upload without background removal
      handleUploadAssinatura(idx, rawFile)
    } finally {
      setProcessing(false)
    }
  }

  async function confirmPreview() {
    if (!preview) return
    const { idx, file } = preview
    setPreview(null)
    await handleUploadAssinatura(idx, file)
  }

  function cancelPreview() {
    if (preview) {
      URL.revokeObjectURL(preview.original)
      setPreview(null)
    }
    // Reset file input so the same file can be picked again
    fileInputRefs.current.forEach((el) => { if (el) el.value = '' })
  }

  async function handleAdd() {
    if (!novoNome.trim()) return
    const novo: MesaMembro = { nome: novoNome.trim(), cpf: novoCpf.trim(), cargo: novoCargo }
    const nova = [...mesa, novo]
    setSaving(true)
    try {
      await updateMesaDiretora(assembleia.id, nova)
      setMesa(nova)
      setNovoNome(''); setNovoCpf(''); setNovoCargo('presidente_mesa')
      setShowForm(false)
      onUpdate()
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : '')
    } finally { setSaving(false) }
  }

  async function handleRemove(idx: number) {
    const nova = mesa.filter((_, i) => i !== idx)
    setSaving(true)
    try {
      await updateMesaDiretora(assembleia.id, nova)
      setMesa(nova)
      onUpdate()
    } catch (e) {
      toast.error('Erro ao remover', e instanceof Error ? e.message : '')
    } finally { setSaving(false) }
  }

  async function handleUploadAssinatura(idx: number, file: File) {
    setUploadingIdx(idx)
    try {
      const url = await uploadAssinaturaMesa(file, assembleia.condominio_id, assembleia.id)
      const nova = mesa.map((m, i) => i === idx ? { ...m, assinatura_url: url } : m)
      await updateMesaDiretora(assembleia.id, nova)
      setMesa(nova)
      onUpdate()
    } catch (e) {
      toast.error('Erro ao subir assinatura', e instanceof Error ? e.message : '')
    } finally { setUploadingIdx(null) }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Mesa Diretora</h3>
          <p className="text-xs text-slate-500 mt-0.5">Membros que assinarão a ata de votação para validade em cartório.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-brand-400 hover:underline"
          >
            + Adicionar membro
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="mb-4 p-3 rounded-md border border-slate-700 bg-slate-800/40 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome completo</label>
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome"
                className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CPF</label>
              <input
                value={novoCpf}
                onChange={(e) => setNovoCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-brand-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cargo na mesa</label>
            <select
              value={novoCargo}
              onChange={(e) => setNovoCargo(e.target.value as CargoMesa)}
              className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:border-brand-500 outline-none"
            >
              {CARGO_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancelar</button>
            <button
              onClick={handleAdd}
              disabled={saving || !novoNome.trim()}
              className="px-3 py-1.5 rounded bg-brand-700 hover:bg-brand-800 text-white text-xs font-medium disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {mesa.length === 0 ? (
        <div className="text-sm text-slate-500">Nenhum membro configurado ainda.</div>
      ) : (
        <ul className="space-y-2">
          {mesa.map((m, idx) => (
            <li key={idx} className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                {m.assinatura_url ? (
                  <img src={m.assinatura_url} alt="assinatura" className="h-8 w-20 object-contain rounded bg-white/10 shrink-0" />
                ) : (
                  <div className="h-8 w-20 rounded border border-dashed border-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-slate-600">sem assin.</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-100 truncate">{m.nome}</div>
                  <div className="text-xs text-slate-500">
                    {CARGO_LABEL[m.cargo]}
                    {m.cpf && <span className="ml-2 font-mono">{m.cpf}</span>}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-xs text-brand-400 hover:underline cursor-pointer">
                    {uploadingIdx === idx ? 'Enviando...' : processing ? 'Processando...' : m.assinatura_url ? 'Trocar assin.' : 'Subir assin.'}
                    <input
                      ref={(el) => { fileInputRefs.current[idx] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingIdx !== null || processing}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) openPreview(idx, f)
                      }}
                    />
                  </label>
                  <button
                    onClick={() => handleRemove(idx)}
                    disabled={saving}
                    className="text-xs text-slate-500 hover:text-red-400 transition"
                  >
                    Remover
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Background removal preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-sm font-semibold text-slate-100 mb-1">Confirmar assinatura</h4>
            <p className="text-xs text-slate-400 mb-4">
              O fundo branco foi removido automaticamente. Confira o resultado antes de salvar.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Original</p>
                <div className="rounded-lg border border-slate-700 bg-white p-2 h-24 flex items-center justify-center">
                  <img src={preview.original} alt="original" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Sem fundo</p>
                <div
                  className="rounded-lg border border-slate-700 h-24 flex items-center justify-center"
                  style={{ background: 'repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 0 0 / 12px 12px' }}
                >
                  <img src={preview.processed} alt="processada" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelPreview}
                className="flex-1 py-2 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPreview}
                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition"
              >
                Usar sem fundo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PresencasCard({
  presencas, nomes, userId, canManage, onToggle, onCheckIn, busy,
}: {
  presencas: AssembleiaPresenca[]
  nomes: Record<string, string>
  userId: string | null
  canManage: boolean
  onToggle: () => void
  onCheckIn: (id: string) => void
  busy: boolean
}) {
  const confirmadas = presencas.length
  const presentes = presencas.filter((p) => p.presente_em).length
  const minhaPresenca = userId ? presencas.find((p) => p.user_id === userId) : null

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-100">Presença</h3>
        <span className="text-xs text-slate-400">
          {confirmadas} confirmada{confirmadas !== 1 ? 's' : ''}
          {canManage && presentes > 0 && ` · ${presentes} presente${presentes !== 1 ? 's' : ''}`}
        </span>
      </div>

      {userId && (
        <button
          onClick={onToggle}
          disabled={busy}
          className={`w-full px-3 py-2 rounded-md text-sm font-medium transition ${
            minhaPresenca
              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-100'
              : 'bg-brand-700 hover:bg-brand-800 text-white'
          } disabled:opacity-50`}
        >
          {minhaPresenca ? '✓ Vou comparecer · clique para cancelar' : 'Confirmar presença'}
        </button>
      )}

      {canManage && presencas.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Lista de confirmados (check-in)
          </div>
          <ul className="space-y-1.5">
            {presencas.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm gap-2">
                <span className="text-slate-200 text-sm">{nomes[p.user_id] ?? 'Morador'}</span>
                {p.presente_em ? (
                  <span className="text-emerald-400 text-xs">
                    ✓ presente em {new Date(p.presente_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <button
                    onClick={() => onCheckIn(p.id)}
                    disabled={busy}
                    className="text-xs text-brand-400 hover:underline"
                  >
                    marcar presente
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

