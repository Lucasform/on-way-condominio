import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getChamado, updateChamadoStatus } from '../lib/chamados'
import { getUnidade } from '../lib/unidades'
import type { Chamado, StatusChamado } from '../types/chamado'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextArea } from '../components/ui/Input'

const STATUS_LABEL: Record<StatusChamado, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

const STATUS_CLASS: Record<StatusChamado, string> = {
  aberto: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_andamento: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  aguardando: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  resolvido: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

const TRANSITIONS: Record<StatusChamado, StatusChamado[]> = {
  aberto: ['em_andamento', 'aguardando', 'cancelado'],
  em_andamento: ['aguardando', 'resolvido', 'cancelado'],
  aguardando: ['em_andamento', 'resolvido', 'cancelado'],
  resolvido: ['em_andamento'],
  cancelado: ['aberto'],
}

export default function ChamadoDetalhe() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const canManage = perfil && ['admin_onway', 'administradora', 'sindico'].includes(perfil.role)

  const [chamado, setChamado] = useState<Chamado | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const [resolNota, setResolNota] = useState('')
  const [showResolForm, setShowResolForm] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const c = await getChamado(id)
      if (!c) {
        setError('Chamado não encontrado.')
        setLoading(false)
        return
      }
      setChamado(c)
      if (c.unidade_id) {
        const u = await getUnidade(c.unidade_id)
        setUnidade(u)
      }
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

  async function handleChange(newStatus: StatusChamado) {
    if (!chamado) return
    if (newStatus === 'resolvido') {
      setShowResolForm(true)
      return
    }
    if (!window.confirm(`Mudar status para "${STATUS_LABEL[newStatus]}"?`)) return
    setChanging(true)
    try {
      await updateChamadoStatus(chamado.id, newStatus)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setChanging(false)
    }
  }

  async function handleResolve() {
    if (!chamado) return
    setChanging(true)
    try {
      await updateChamadoStatus(chamado.id, 'resolvido', resolNota)
      setShowResolForm(false)
      setResolNota('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setChanging(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  if (error || !chamado) {
    return (
      <div className="px-8 py-10 max-w-2xl mx-auto">
        <PageHeader
          title="Chamado"
          actions={<Link to="/chamados"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrado.'}
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Chamado"
        actions={<Link to="/chamados"><Button variant="ghost">← Voltar</Button></Link>}
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">{chamado.titulo}</h2>
            <div className="text-xs text-slate-500 mt-1">
              {chamado.categoria} · prioridade {chamado.prioridade}
              {unidade && ` · ${unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero}`}
            </div>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded text-sm border ${STATUS_CLASS[chamado.status]}`}>
            {STATUS_LABEL[chamado.status]}
          </span>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Descrição</div>
          <p className="text-slate-100 whitespace-pre-wrap">{chamado.descricao}</p>
        </div>

        {chamado.resolucao_nota && (
          <div className="border-t border-slate-800 pt-4 mt-4">
            <div className="text-xs font-medium text-emerald-300 uppercase tracking-wide mb-1">Resolução</div>
            <p className="text-slate-200 whitespace-pre-wrap text-sm">{chamado.resolucao_nota}</p>
            {chamado.resolvido_em && (
              <p className="text-xs text-slate-500 mt-1">
                em {new Date(chamado.resolvido_em).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 text-xs text-slate-600">
          Aberto em {new Date(chamado.created_at).toLocaleString('pt-BR')}
        </div>
      </div>

      {canManage && TRANSITIONS[chamado.status].length > 0 && !showResolForm && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-300 mb-3">Mudar status para:</div>
          <div className="flex flex-wrap gap-2">
            {TRANSITIONS[chamado.status].map((s) => (
              <Button
                key={s}
                variant="secondary"
                onClick={() => handleChange(s)}
                disabled={changing}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {showResolForm && (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="text-sm font-medium text-emerald-200 mb-3">Marcar como resolvido</div>
          <Field label="Nota de resolução (opcional)">
            <TextArea
              rows={3}
              value={resolNota}
              onChange={(e) => setResolNota(e.target.value)}
              placeholder="O que foi feito pra resolver."
            />
          </Field>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleResolve} disabled={changing}>
              {changing ? 'Confirmando...' : 'Confirmar resolução'}
            </Button>
            <Button variant="secondary" onClick={() => setShowResolForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
