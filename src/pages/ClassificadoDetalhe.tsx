import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getClassificado, updateClassificado, deleteClassificado } from '../lib/classificados'
import type { Classificado, StatusClassificado } from '../types/classificado'
import { CATEGORIA_LABEL, CATEGORIA_EMOJI } from '../types/classificado'
import { useAuth } from '../components/AuthProvider'
import { isStaff } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { DetailSkeleton } from '../components/ui/Skeleton'

const STATUS_OPTS: { value: StatusClassificado; label: string }[] = [
  { value: 'ativo', label: 'Disponível' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const STATUS_CLASS: Record<StatusClassificado, string> = {
  ativo: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  vendido: 'bg-slate-700/40 text-slate-400 border-slate-700',
  cancelado: 'bg-red-500/10 text-red-300 border-red-500/30',
}

export default function ClassificadoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const canManage = isStaff(perfil?.role)

  const [classificado, setClassificado] = useState<Classificado | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fotoIdx, setFotoIdx] = useState(0)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const data = await getClassificado(id)
      if (!data) setError('Anúncio não encontrado.')
      else setClassificado(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleStatus(status: StatusClassificado) {
    if (!classificado) return
    setBusy(true)
    try {
      await updateClassificado(classificado.id, { status })
      setClassificado((prev) => prev ? { ...prev, status } : prev)
      toast.success('Status atualizado.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!classificado) return
    const ok = await confirm({
      title: 'Excluir anúncio',
      message: 'Excluir este anúncio definitivamente?',
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteClassificado(classificado.id)
      toast.success('Anúncio excluído.')
      navigate('/classificados')
    } catch (e) {
      toast.error('Erro ao excluir', e instanceof Error ? e.message : '')
      setBusy(false)
    }
  }

  if (loading) return <DetailSkeleton />

  if (error || !classificado) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader title="Classificado" actions={<Link to="/classificados"><Button variant="ghost">← Voltar</Button></Link>} />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">{error ?? 'Não encontrado.'}</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={classificado.titulo}
        actions={
          <div className="flex items-center gap-2">
            {canManage && <DeleteButton onClick={handleDelete} disabled={busy} />}
            <Link to="/classificados"><Button variant="ghost">← Voltar</Button></Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fotos */}
        <div>
          {classificado.fotos.length > 0 ? (
            <div>
              <div className="rounded-lg overflow-hidden bg-slate-900 aspect-video mb-2">
                <img
                  src={classificado.fotos[fotoIdx]}
                  alt={classificado.titulo}
                  className="w-full h-full object-contain"
                />
              </div>
              {classificado.fotos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {classificado.fotos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setFotoIdx(i)}
                      className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition ${
                        i === fotoIdx ? 'border-brand-500' : 'border-transparent'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-slate-800/60 aspect-video flex items-center justify-center text-6xl">
              {CATEGORIA_EMOJI[classificado.categoria]}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[classificado.status]}`}>
              {STATUS_OPTS.find((o) => o.value === classificado.status)?.label}
            </span>
            <span className="text-xs text-slate-500">
              {CATEGORIA_EMOJI[classificado.categoria]} {CATEGORIA_LABEL[classificado.categoria]}
            </span>
          </div>

          <div className="text-2xl font-bold text-emerald-400 mb-4">
            {classificado.preco != null
              ? `R$ ${classificado.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : 'A combinar'}
          </div>

          {classificado.descricao && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 mb-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Descrição</div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{classificado.descricao}</p>
            </div>
          )}

          {classificado.link_externo && (
            <a
              href={classificado.link_externo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition mb-4"
            >
              🔗 Ver no marketplace externo
            </a>
          )}

          <div className="text-xs text-slate-600 mb-6">
            Publicado em {new Date(classificado.created_at).toLocaleDateString('pt-BR')}
          </div>

          {/* Gerenciar status (admin/staff) */}
          {canManage && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Alterar status</div>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatus(opt.value)}
                    disabled={busy || classificado.status === opt.value}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition disabled:opacity-50 ${
                      classificado.status === opt.value
                        ? 'bg-brand-700 border-brand-600 text-white'
                        : 'border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
