import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getOcorrencia,
  getOcorrenciaFotoSignedUrl,
  updateOcorrenciaStatus,
} from '../lib/ocorrencias'
import { getUnidade } from '../lib/unidades'
import { getPessoa } from '../lib/pessoas'
import { getCondominio } from '../lib/condominios'
import { getMultaByOcorrencia } from '../lib/multas'
import type { Ocorrencia, StatusOcorrencia } from '../types/ocorrencia'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import type { Multa } from '../types/multa'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import AIAnalysisPanel from '../components/AIAnalysisPanel'

const STATUS_LABEL: Record<StatusOcorrencia, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  arquivada: 'Arquivada',
  virou_multa: 'Virou multa',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<StatusOcorrencia, string> = {
  aberta: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_analise: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  arquivada: 'bg-slate-700/40 text-slate-400 border-slate-700',
  virou_multa: 'bg-red-500/10 text-red-300 border-red-500/30',
  cancelada: 'bg-slate-700/40 text-slate-500 border-slate-700',
}

// Quem pode mudar status: admin_onway, administradora, sindico
const CAN_CHANGE_STATUS = ['admin_onway', 'administradora', 'sindico'] as const

// Transições permitidas a partir de cada status
const ALLOWED_TRANSITIONS: Record<StatusOcorrencia, StatusOcorrencia[]> = {
  aberta: ['em_analise', 'arquivada', 'cancelada'],
  em_analise: ['arquivada', 'virou_multa', 'cancelada'],
  arquivada: ['em_analise'],
  virou_multa: [], // imutável depois que virou multa (a multa em si tem outro fluxo)
  cancelada: [],
}

export default function OcorrenciaDetalhe() {
  const { id } = useParams()
  const { perfil } = useAuth()

  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [multaVinculada, setMultaVinculada] = useState<Multa | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const o = await getOcorrencia(id)
      if (!o) {
        setError('Ocorrência não encontrada.')
        setLoading(false)
        return
      }
      setOcorrencia(o)

      // Carrega relacionados em paralelo
      const [un, pe, co, fu, mu] = await Promise.all([
        o.unidade_id ? getUnidade(o.unidade_id) : Promise.resolve(null),
        o.pessoa_envolvida_id ? getPessoa(o.pessoa_envolvida_id) : Promise.resolve(null),
        getCondominio(o.condominio_id),
        o.foto_url ? getOcorrenciaFotoSignedUrl(o.foto_url, 3600) : Promise.resolve(null),
        o.status === 'virou_multa' ? getMultaByOcorrencia(o.id) : Promise.resolve(null),
      ])
      setUnidade(un)
      setPessoa(pe)
      setCondominio(co)
      setFotoUrl(fu)
      setMultaVinculada(mu)
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

  async function handleChangeStatus(newStatus: StatusOcorrencia) {
    if (!ocorrencia) return
    if (!window.confirm(`Mudar status para "${STATUS_LABEL[newStatus]}"?`)) return
    setChanging(true)
    try {
      await updateOcorrenciaStatus(ocorrencia.id, newStatus)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao mudar status.')
    } finally {
      setChanging(false)
    }
  }

  if (loading) {
    return <div className="px-8 py-10 text-slate-400">Carregando...</div>
  }

  if (error || !ocorrencia) {
    return (
      <div className="px-8 py-10 max-w-2xl">
        <PageHeader
          title="Ocorrência"
          actions={
            <Link to="/ocorrencias">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          }
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const canChangeStatus = perfil && (CAN_CHANGE_STATUS as readonly string[]).includes(perfil.role)
  const canGenerateMulta = canChangeStatus && ['aberta', 'em_analise'].includes(ocorrencia.status)
  const transitions = ALLOWED_TRANSITIONS[ocorrencia.status]

  return (
    <div className="px-8 py-10 max-w-3xl">
      <PageHeader
        title="Ocorrência"
        actions={
          <Link to="/ocorrencias">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="text-sm text-slate-400">
            {new Date(ocorrencia.created_at).toLocaleString('pt-BR', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </div>
          <span
            className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[ocorrencia.status]}`}
          >
            {STATUS_LABEL[ocorrencia.status]}
          </span>
        </div>

        <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm mb-6">
          <dt className="text-slate-500">Condomínio</dt>
          <dd className="text-slate-200">{condominio?.nome ?? '—'}</dd>

          <dt className="text-slate-500">Unidade</dt>
          <dd className="text-slate-200">
            {unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : 'Área comum'}
          </dd>

          {ocorrencia.local && (
            <>
              <dt className="text-slate-500">Local</dt>
              <dd className="text-slate-200">{ocorrencia.local}</dd>
            </>
          )}

          {pessoa && (
            <>
              <dt className="text-slate-500">Pessoa envolvida</dt>
              <dd className="text-slate-200">{pessoa.nome}</dd>
            </>
          )}
        </dl>

        <div className="border-t border-slate-800 pt-5">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Descrição
          </div>
          <p className="text-slate-100 whitespace-pre-wrap">{ocorrencia.descricao}</p>
        </div>

        {fotoUrl && (
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Foto
            </div>
            <a href={fotoUrl} target="_blank" rel="noreferrer" className="block max-w-md">
              <img
                src={fotoUrl}
                alt="Foto da ocorrência"
                className="w-full h-auto rounded-md border border-slate-800 hover:opacity-90 transition"
              />
            </a>
          </div>
        )}
      </div>

      <AIAnalysisPanel
        ocorrenciaId={ocorrencia.id}
        canAnalyse={!!canChangeStatus}
        canGenerateMulta={!!canGenerateMulta}
      />

      {canGenerateMulta && (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="text-sm font-medium text-emerald-200 mb-1">Gerar multa manual</div>
          <div className="text-xs text-slate-400 mb-3">
            Pula a análise e cria a multa manualmente.
          </div>
          <Link to={`/multas/nova?ocorrencia=${ocorrencia.id}`}>
            <Button variant="secondary">Gerar multa a partir desta ocorrência →</Button>
          </Link>
        </div>
      )}

      {ocorrencia.status === 'virou_multa' && multaVinculada && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-5">
          <div className="text-sm font-medium text-red-200 mb-1">Multa gerada</div>
          <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500">Valor</dt>
            <dd className="text-slate-100 font-medium">R$ {multaVinculada.valor.toFixed(2).replace('.', ',')}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd className="text-slate-200 capitalize">{multaVinculada.status.replace('_', ' ')}</dd>
            {multaVinculada.artigo_regimento && (
              <>
                <dt className="text-slate-500">Artigo</dt>
                <dd className="text-slate-200">{multaVinculada.artigo_regimento}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {canChangeStatus && transitions.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-300 mb-3">Mudar status para:</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((s) => (
              <Button
                key={s}
                variant="secondary"
                onClick={() => handleChangeStatus(s)}
                disabled={changing}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-xs text-slate-600">
        ID: <span className="font-mono">{ocorrencia.id}</span>
      </div>
    </div>
  )
}
