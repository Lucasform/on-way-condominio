import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getEncomenda,
  darBaixaEncomenda,
  devolverEncomenda,
} from '../lib/encomendas'
import { getUnidade } from '../lib/unidades'
import { getPessoa } from '../lib/pessoas'
import { getCondominio } from '../lib/condominios'
import type { Encomenda, StatusEncomenda, TipoEncomenda } from '../types/encomenda'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput } from '../components/ui/Input'

const STATUS_CLASS: Record<StatusEncomenda, string> = {
  aguardando: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  entregue: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  devolvida: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

const STATUS_LABEL: Record<StatusEncomenda, string> = {
  aguardando: 'Aguardando retirada',
  entregue: 'Entregue',
  devolvida: 'Devolvida',
}

const TIPO_ICON: Record<TipoEncomenda, string> = {
  encomenda: '📦',
  comida: '🍔',
  documento: '📄',
  outro: '📬',
}

const TIPO_LABEL: Record<TipoEncomenda, string> = {
  encomenda: 'Encomenda',
  comida: 'Comida',
  documento: 'Documento',
  outro: 'Outro',
}

const CAN_BAIXA = ['admin_onway', 'administradora', 'sindico', 'portaria'] as const

export default function EncomendaDetalhe() {
  const { id } = useParams()
  const { user, perfil } = useAuth()

  const [encomenda, setEncomenda] = useState<Encomenda | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showBaixaForm, setShowBaixaForm] = useState(false)
  const [entreguePara, setEntreguePara] = useState('')
  const [submittingBaixa, setSubmittingBaixa] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const e = await getEncomenda(id)
      if (!e) {
        setError('Encomenda não encontrada.')
        setLoading(false)
        return
      }
      setEncomenda(e)
      const [un, pe, co] = await Promise.all([
        getUnidade(e.unidade_id),
        e.pessoa_id ? getPessoa(e.pessoa_id) : Promise.resolve(null),
        getCondominio(e.condominio_id),
      ])
      setUnidade(un)
      setPessoa(pe)
      setCondominio(co)
      // Pré-preenche "entregue para" com nome da pessoa nominada (se houver)
      if (pe) setEntreguePara(pe.nome)
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

  async function handleBaixa(e: FormEvent) {
    e.preventDefault()
    if (!encomenda || !user) return
    if (!entreguePara.trim()) {
      alert('Informe quem retirou a encomenda.')
      return
    }
    setSubmittingBaixa(true)
    try {
      await darBaixaEncomenda(encomenda.id, entreguePara, user.id)
      await load()
      setShowBaixaForm(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao dar baixa.')
    } finally {
      setSubmittingBaixa(false)
    }
  }

  async function handleDevolver() {
    if (!encomenda) return
    if (!window.confirm('Marcar como devolvida? Esta ação registra que a encomenda foi devolvida ao remetente.')) return
    try {
      await devolverEncomenda(encomenda.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  if (error || !encomenda) {
    return (
      <div className="px-8 py-10 max-w-2xl">
        <PageHeader
          title="Encomenda"
          actions={<Link to="/encomendas"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const canBaixa = perfil && (CAN_BAIXA as readonly string[]).includes(perfil.role)
  const unidadeLabel = unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'

  return (
    <div className="px-8 py-10 max-w-3xl">
      <PageHeader
        title="Encomenda"
        actions={<Link to="/encomendas"><Button variant="ghost">← Voltar</Button></Link>}
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="text-5xl shrink-0 leading-none">{TIPO_ICON[encomenda.tipo]}</div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">{TIPO_LABEL[encomenda.tipo]}</div>
            <div className="text-xl font-semibold text-slate-100 mt-0.5">{unidadeLabel}</div>
            {condominio && <div className="text-xs text-slate-500 mt-0.5">{condominio.nome}</div>}
          </div>
          <span className={`shrink-0 px-3 py-1 rounded text-sm border ${STATUS_CLASS[encomenda.status]}`}>
            {STATUS_LABEL[encomenda.status]}
          </span>
        </div>

        <dl className="grid grid-cols-[160px_1fr] gap-y-2 gap-x-4 text-sm mb-5">
          <dt className="text-slate-500">Recebida em</dt>
          <dd className="text-slate-200">{new Date(encomenda.created_at).toLocaleString('pt-BR')}</dd>

          {pessoa && (
            <>
              <dt className="text-slate-500">Destinatário</dt>
              <dd className="text-slate-200">{pessoa.nome}</dd>
            </>
          )}

          {encomenda.transportadora && (
            <>
              <dt className="text-slate-500">Transportadora</dt>
              <dd className="text-slate-200">{encomenda.transportadora}</dd>
            </>
          )}

          {encomenda.codigo_rastreio && (
            <>
              <dt className="text-slate-500">Rastreio</dt>
              <dd className="text-slate-200 font-mono text-xs">{encomenda.codigo_rastreio}</dd>
            </>
          )}

          {encomenda.local_armazenamento && (
            <>
              <dt className="text-slate-500">Armazenada em</dt>
              <dd className="text-slate-200">📍 {encomenda.local_armazenamento}</dd>
            </>
          )}

          {encomenda.entregue_em && (
            <>
              <dt className="text-slate-500">Entregue em</dt>
              <dd className="text-slate-200">{new Date(encomenda.entregue_em).toLocaleString('pt-BR')}</dd>
              <dt className="text-slate-500">Retirada por</dt>
              <dd className="text-slate-200">{encomenda.entregue_para}</dd>
            </>
          )}
        </dl>

        {encomenda.descricao && (
          <div className="border-t border-slate-800 pt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Descrição</div>
            <p className="text-slate-100 whitespace-pre-wrap">{encomenda.descricao}</p>
          </div>
        )}

        {encomenda.observacoes && (
          <div className="border-t border-slate-800 pt-4 mt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Observações</div>
            <p className="text-slate-300 whitespace-pre-wrap text-sm">{encomenda.observacoes}</p>
          </div>
        )}
      </div>

      {canBaixa && encomenda.status === 'aguardando' && (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
          {!showBaixaForm ? (
            <div className="flex flex-wrap gap-3 items-center">
              <Button onClick={() => setShowBaixaForm(true)}>✓ Dar baixa (entregar)</Button>
              <Button variant="danger" onClick={handleDevolver}>Marcar como devolvida</Button>
            </div>
          ) : (
            <form onSubmit={handleBaixa} className="space-y-4">
              <Field label="Quem retirou a encomenda?" required hint="Nome de quem está levando agora.">
                <TextInput
                  required
                  value={entreguePara}
                  onChange={(e) => setEntreguePara(e.target.value)}
                  autoFocus
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={submittingBaixa}>
                  {submittingBaixa ? 'Confirmando...' : 'Confirmar entrega'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowBaixaForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="mt-8 text-xs text-slate-600">
        ID: <span className="font-mono">{encomenda.id}</span>
      </div>
    </div>
  )
}
