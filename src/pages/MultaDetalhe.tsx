import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getMulta,
  changeMultaStatus,
  deleteMulta,
  MULTA_STATUS_TRANSITIONS,
  MULTA_STATUS_LABEL,
} from '../lib/multas'
import { getUnidade } from '../lib/unidades'
import { getPessoa } from '../lib/pessoas'
import { getCondominio } from '../lib/condominios'
import type { Multa, StatusMulta } from '../types/multa'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import ContestacaoThread from '../components/ContestacaoThread'
import DeleteButton from '../components/ui/DeleteButton'
import { gerarPdfNotificacao } from '../lib/multaPdf'

const STATUS_CLASS: Record<StatusMulta, string> = {
  em_analise: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  aplicada: 'bg-red-500/10 text-red-300 border-red-500/30',
  paga: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  contestada: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  cancelada: 'bg-slate-700/40 text-slate-500 border-slate-700',
  arquivada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

const CAN_CHANGE = ['admin_onway', 'administradora', 'sindico', 'subsindico'] as const

export default function MultaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()

  const [multa, setMulta] = useState<Multa | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const m = await getMulta(id)
      if (!m) {
        setError('Multa não encontrada.')
        setLoading(false)
        return
      }
      setMulta(m)
      const [un, pe, co] = await Promise.all([
        getUnidade(m.unidade_id),
        m.pessoa_id ? getPessoa(m.pessoa_id) : Promise.resolve(null),
        getCondominio(m.condominio_id),
      ])
      setUnidade(un)
      setPessoa(pe)
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

  async function handleDelete() {
    if (!multa) return
    const ok = window.confirm(
      'Excluir esta multa DEFINITIVAMENTE? Esta ação não pode ser desfeita.',
    )
    if (!ok) return
    setChanging(true)
    try {
      await deleteMulta(multa.id)
      navigate('/multas')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir.')
      setChanging(false)
    }
  }

  async function handleChange(newStatus: StatusMulta) {
    if (!multa) return
    if (!window.confirm(`Mudar status para "${MULTA_STATUS_LABEL[newStatus]}"?`)) return
    setChanging(true)
    try {
      await changeMultaStatus(multa.id, newStatus)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao mudar status.')
    } finally {
      setChanging(false)
    }
  }

  if (loading) return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>

  if (error || !multa) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader
          title="Multa"
          actions={<Link to="/multas"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const canChange = perfil && (CAN_CHANGE as readonly string[]).includes(perfil.role)
  const canDelete = isGestor(perfil?.role)
  const transitions = MULTA_STATUS_TRANSITIONS[multa.status]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Multa"
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={changing} />
            )}
            <Button
              variant="secondary"
              onClick={() => condominio && gerarPdfNotificacao({
                multa,
                unidade,
                pessoa,
                condominio,
                assinaturaUrl: perfil?.assinatura_url ?? null,
                emissorNome: perfil?.nome_exibicao ?? null,
              }).catch((e) => alert(e.message))}
              disabled={!condominio}
              title="Gerar PDF de notificação"
            >
              📄 Gerar PDF
            </Button>
            <Link to="/multas"><Button variant="ghost">← Voltar</Button></Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-3xl font-bold text-slate-100">
              R$ {Number(multa.valor).toFixed(2).replace('.', ',')}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Registrada em {new Date(multa.created_at).toLocaleString('pt-BR')}
            </div>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded text-sm border ${STATUS_CLASS[multa.status]}`}>
            {MULTA_STATUS_LABEL[multa.status]}
          </span>
        </div>

        <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm mb-5">
          <dt className="text-slate-500">Condomínio</dt>
          <dd className="text-slate-200">{condominio?.nome ?? '—'}</dd>

          <dt className="text-slate-500">Unidade</dt>
          <dd className="text-slate-200">
            {unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'}
            {unidade && (
              <Link to={`/unidades/${unidade.id}/historico`} className="ml-3 text-xs text-emerald-400 hover:underline">
                ver histórico →
              </Link>
            )}
          </dd>

          {pessoa && (
            <>
              <dt className="text-slate-500">Pessoa</dt>
              <dd className="text-slate-200">{pessoa.nome}</dd>
            </>
          )}

          {multa.artigo_regimento && (
            <>
              <dt className="text-slate-500">Artigo</dt>
              <dd className="text-slate-200">{multa.artigo_regimento}</dd>
            </>
          )}

          {multa.data_aplicacao && (
            <>
              <dt className="text-slate-500">Aplicada em</dt>
              <dd className="text-slate-200">{new Date(multa.data_aplicacao).toLocaleDateString('pt-BR')}</dd>
            </>
          )}

          {multa.data_pagamento && (
            <>
              <dt className="text-slate-500">Paga em</dt>
              <dd className="text-slate-200">{new Date(multa.data_pagamento).toLocaleDateString('pt-BR')}</dd>
            </>
          )}

          {multa.ocorrencia_id && (
            <>
              <dt className="text-slate-500">Ocorrência</dt>
              <dd>
                <Link to={`/ocorrencias/${multa.ocorrencia_id}`} className="text-emerald-400 hover:underline">
                  ver ocorrência origem →
                </Link>
              </dd>
            </>
          )}
        </dl>

        <div className="border-t border-slate-800 pt-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Descrição</div>
          <p className="text-slate-100 whitespace-pre-wrap">{multa.descricao}</p>
        </div>

        {multa.observacoes && (
          <div className="border-t border-slate-800 pt-4 mt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Observações internas
            </div>
            <p className="text-slate-300 whitespace-pre-wrap text-sm">{multa.observacoes}</p>
          </div>
        )}
      </div>

      {canChange && transitions.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-300 mb-3">Mudar status para:</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((s) => (
              <Button
                key={s}
                variant="secondary"
                onClick={() => handleChange(s)}
                disabled={changing}
              >
                {MULTA_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {canChange && transitions.length === 0 && (
        <div className="mt-6 text-xs text-slate-500">
          Status terminal — nenhuma transição disponível.
        </div>
      )}

      <ContestacaoThread
        multaId={multa.id}
        pessoaUserId={pessoa?.user_id ?? null}
      />

    </div>
  )
}
