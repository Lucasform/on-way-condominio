import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteVotacao, getVotacao, votar, encerrarVotacao, cancelarVotacao } from '../lib/votacoes'
import type { Votacao, VotacaoOpcao, Voto, StatusVotacao } from '../types/votacao'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'

const STATUS_LABEL: Record<StatusVotacao, string> = {
  aberta: 'Aberta',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<StatusVotacao, string> = {
  aberta: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  encerrada: 'bg-slate-700/40 text-slate-400 border-slate-700',
  cancelada: 'bg-red-500/10 text-red-300 border-red-500/30',
}

export default function VotacaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const canDelete = perfil?.role === 'admin_onway' || perfil?.role === 'sindico'

  const [votacao, setVotacao] = useState<Votacao | null>(null)
  const [opcoes, setOpcoes] = useState<VotacaoOpcao[]>([])
  const [votos, setVotos] = useState<Voto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const result = await getVotacao(id)
      if (!result) {
        setError('Votação não encontrada.')
      } else {
        setVotacao(result.votacao)
        setOpcoes(result.opcoes)
        setVotos(result.votos)
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

  async function handleVotar(opcaoId: string) {
    if (!user || !votacao) return
    setSubmitting(true)
    try {
      await votar(votacao.id, opcaoId, user.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao votar.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!votacao) return
    if (!window.confirm('Excluir essa votação DEFINITIVAMENTE? Esta ação não pode ser desfeita.')) return
    try {
      await deleteVotacao(votacao.id)
      navigate('/votacoes')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir.')
    }
  }

  async function handleEncerrar() {
    if (!votacao) return
    if (!window.confirm('Encerrar votação? Não poderá mais receber votos.')) return
    try {
      await encerrarVotacao(votacao.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function handleCancelar() {
    if (!votacao) return
    if (!window.confirm('Cancelar votação?')) return
    try {
      await cancelarVotacao(votacao.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  if (error || !votacao) {
    return (
      <div className="px-8 py-10 max-w-2xl mx-auto">
        <PageHeader
          title="Votação"
          actions={<Link to="/votacoes"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrada.'}
        </div>
      </div>
    )
  }

  const totalVotos = votos.length
  const meuVoto = user ? votos.find((v) => v.user_id === user.id) : null
  const podeVotar = votacao.status === 'aberta' && (!votacao.data_fim || new Date(votacao.data_fim) > new Date())
  const canManage = perfil && ['admin_onway', 'administradora', 'sindico'].includes(perfil.role)

  const votosPorOpcao = opcoes.map((o) => ({
    opcao: o,
    count: votos.filter((v) => v.opcao_id === o.id).length,
  }))

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Votação"
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} />
            )}
            <Link to="/votacoes"><Button variant="ghost">← Voltar</Button></Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-slate-100">{votacao.titulo}</h2>
          <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[votacao.status]}`}>
            {STATUS_LABEL[votacao.status]}
          </span>
        </div>
        {votacao.descricao && (
          <p className="text-slate-300 whitespace-pre-wrap mb-4">{votacao.descricao}</p>
        )}
        <div className="text-xs text-slate-500 mb-6">
          Início: {new Date(votacao.data_inicio).toLocaleString('pt-BR')}
          {votacao.data_fim && ` · Fim: ${new Date(votacao.data_fim).toLocaleString('pt-BR')}`}
          {' · '}
          <strong className="text-slate-300">{totalVotos} voto(s)</strong>
        </div>

        <div className="space-y-3">
          {votosPorOpcao.map(({ opcao, count }) => {
            const pct = totalVotos > 0 ? Math.round((count / totalVotos) * 100) : 0
            const meuVotoNessaOpcao = meuVoto?.opcao_id === opcao.id
            return (
              <div key={opcao.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    {podeVotar ? (
                      <button
                        onClick={() => handleVotar(opcao.id)}
                        disabled={submitting}
                        className={`flex-1 text-left px-3 py-2 rounded-md border transition ${
                          meuVotoNessaOpcao
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100'
                            : 'bg-slate-800/40 border-slate-700 text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        <span className="font-medium">{opcao.texto}</span>
                        {meuVotoNessaOpcao && <span className="ml-2 text-xs">✓ seu voto</span>}
                      </button>
                    ) : (
                      <div className="flex-1 px-3 py-2 rounded-md border border-slate-800 bg-slate-900/60">
                        <span className="font-medium text-slate-200">{opcao.texto}</span>
                        {meuVotoNessaOpcao && <span className="ml-2 text-xs text-emerald-400">✓ seu voto</span>}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-mono text-slate-300 w-20 text-right">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {!podeVotar && (
          <div className="mt-4 text-xs text-slate-500 italic">
            {votacao.status === 'aberta'
              ? 'Período de votação encerrado.'
              : `Votação ${STATUS_LABEL[votacao.status].toLowerCase()}.`}
          </div>
        )}
      </div>

      {canManage && votacao.status === 'aberta' && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-300 mb-3">Ações da administração</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleEncerrar}>Encerrar votação</Button>
            <Button variant="danger" onClick={handleCancelar}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
