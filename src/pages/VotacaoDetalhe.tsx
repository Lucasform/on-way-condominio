import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteVotacao, getVotacao, votar, encerrarVotacao, cancelarVotacao } from '../lib/votacoes'
import { getCondominio } from '../lib/condominios'
import { supabase } from '../lib/supabase'
import type { Condominio } from '../types/condominio'
import { gerarPdfAtaVotacao } from '../lib/votacaoPdf'
import type { Votacao, VotacaoOpcao, Voto, StatusVotacao } from '../types/votacao'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { DetailSkeleton } from '../components/ui/Skeleton'
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
  const toast = useToast()
  const confirm = useConfirm()
  const canDelete = isGestor(perfil?.role)

  const [votacao, setVotacao] = useState<Votacao | null>(null)
  const [opcoes, setOpcoes] = useState<VotacaoOpcao[]>([])
  const [votos, setVotos] = useState<Voto[]>([])
  const [condominio, setCondominio] = useState<Condominio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')
  const [minhaUnidadeId, setMinhaUnidadeId] = useState<string | null>(null)

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
        // No modo qrcode o voto é por unidade: resolve a unidade do usuário logado.
        if (result.votacao.modo === 'qrcode' && user) {
          const { data } = await supabase
            .from('pessoas')
            .select('unidade_id')
            .eq('user_id', user.id)
            .not('unidade_id', 'is', null)
            .limit(1)
            .maybeSingle()
          setMinhaUnidadeId((data?.unidade_id as string | undefined) ?? null)
        }
        try {
          const co = await getCondominio(result.votacao.condominio_id)
          setCondominio(co)
        } catch { /* noop */ }
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

  async function handleVotar(opcaoId: string, textoOpcao: string) {
    if (!user || !votacao) return
    const meuVotoAtual = votos.find((v) => v.user_id === user.id)
    // Se ja votou nessa opcao, nao faz nada
    if (meuVotoAtual?.opcao_id === opcaoId) return
    // Se ja votou em outra, confirma a troca
    if (meuVotoAtual) {
      const opcaoAnterior = opcoes.find((o) => o.id === meuVotoAtual.opcao_id)
      const ok = await confirm({
        title: 'Trocar voto',
        message: `Você já votou em "${opcaoAnterior?.texto ?? '(anterior)'}". Trocar para "${textoOpcao}"? O voto pode ser alterado quantas vezes quiser até o encerramento; o que vale é o voto final.`,
        confirmText: 'Trocar voto',
      })
      if (!ok) return
    } else {
      const ok = await confirm({
        title: 'Confirmar voto',
        message: `Confirmar voto em "${textoOpcao}"? Você pode trocar até o encerramento da votação.`,
        confirmText: 'Votar',
      })
      if (!ok) return
    }
    // Código de acesso (quando configurado): exigido pra votar.
    if (votacao.codigo_acesso && codigoInput.trim() !== votacao.codigo_acesso) {
      toast.error('Código incorreto', 'Confira o código de acesso exibido na assembleia.')
      return
    }
    // Modo QR: voto por unidade. Precisa de unidade vinculada.
    let unidade: string | null | undefined
    if (votacao.modo === 'qrcode') {
      if (!minhaUnidadeId) {
        toast.error('Sem unidade', 'Seu cadastro não tem unidade vinculada. Peça à administração pra vincular.')
        return
      }
      unidade = minhaUnidadeId
    }
    setSubmitting(true)
    try {
      await votar(votacao.id, opcaoId, user.id, unidade)
      await load()
      toast.success('Voto registrado.')
    } catch (e) {
      toast.error('Erro ao votar', e instanceof Error ? e.message : '')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!votacao) return
    const ok = await confirm({
      title: 'Excluir votação',
      message: 'Excluir essa votação DEFINITIVAMENTE? Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    try {
      await deleteVotacao(votacao.id)
      toast.success('Votação excluída.')
      navigate('/votacoes')
    } catch (e) {
      toast.error('Erro ao excluir', e instanceof Error ? e.message : '')
    }
  }

  async function handleEncerrar() {
    if (!votacao) return
    if (votacao.quorum_minimo != null && votos.length < votacao.quorum_minimo) {
      toast.warning(
        'Quórum não atingido',
        `Mínimo de ${votacao.quorum_minimo} voto(s), apenas ${votos.length} registrado(s).`,
      )
      return
    }
    const ok = await confirm({ message: 'Encerrar votação? Não poderá mais receber votos.', confirmText: 'Encerrar' })
    if (!ok) return
    try {
      await encerrarVotacao(votacao.id)
      await load()
      toast.success('Votação encerrada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  async function handleExportarAta() {
    if (!votacao) return
    try {
      await gerarPdfAtaVotacao({
        votacao,
        opcoes,
        votos,
        condominio,
        quorumMinimo: votacao.quorum_minimo,
        assinaturaUrl: perfil?.assinatura_url ?? null,
        emissorNome: perfil?.nome_exibicao ?? null,
      })
    } catch (e) {
      toast.error('Erro ao gerar PDF', e instanceof Error ? e.message : '')
    }
  }

  async function handleCancelar() {
    if (!votacao) return
    const ok = await confirm({ message: 'Cancelar votação?', tone: 'danger', confirmText: 'Cancelar votação' })
    if (!ok) return
    try {
      await cancelarVotacao(votacao.id)
      await load()
      toast.success('Votação cancelada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  if (loading) return <DetailSkeleton />

  if (error || !votacao) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
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
  const votacaoAtiva = votacao.status === 'aberta' && (!votacao.data_fim || new Date(votacao.data_fim) > new Date())
  const podeVotar = votacaoAtiva  // troca permitida ate o encerramento
  const canManage = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)

  const votosPorOpcao = opcoes.map((o) => ({
    opcao: o,
    count: votos.filter((v) => v.opcao_id === o.id).length,
  }))

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Votação"
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} />
            )}
            <Button variant="secondary" onClick={handleExportarAta} disabled={!condominio}>
              📄 Exportar ata (PDF)
            </Button>
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
          {votacao.quorum_minimo != null && (
            <>
              {' · '}
              <span className={totalVotos >= votacao.quorum_minimo ? 'text-emerald-400' : 'text-amber-300'}>
                Quórum {totalVotos}/{votacao.quorum_minimo}
              </span>
            </>
          )}
        </div>

        {votacao.modo === 'qrcode' && (
          <div className="mb-4 text-xs rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sky-200">
            📲 Votação por QR/link · 1 voto por unidade.
            {canManage && votacao.codigo_acesso && (
              <span> Código pra anunciar: <strong className="font-mono tracking-wide">{votacao.codigo_acesso}</strong></span>
            )}
          </div>
        )}

        {podeVotar && votacao.codigo_acesso && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-1">Código de acesso (informe pra votar)</label>
            <input
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value)}
              placeholder="código exibido na assembleia"
              className="w-full sm:w-72 px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
        )}

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
                        onClick={() => handleVotar(opcao.id, opcao.texto)}
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

        {canManage && votos.some((v) => !v.verificado) && (
          <div className="mt-3 text-[11px] text-amber-300">
            {votos.filter((v) => !v.verificado).length} voto(s) de convidado (não verificado) incluído(s) na contagem.
          </div>
        )}

        {meuVoto && votacaoAtiva && (
          <div className="mt-4 text-xs italic text-emerald-400">
            ✓ Seu voto foi registrado. Você pode trocar até o encerramento — o voto final é o que vale.
          </div>
        )}
        {!votacaoAtiva && (
          <div className="mt-4 text-xs italic text-slate-500">
            {votacao.status === 'aberta'
              ? 'Período de votação encerrado.'
              : `Votação ${STATUS_LABEL[votacao.status].toLowerCase()}.`}
          </div>
        )}
      </div>

      {canManage && votacao.modo === 'qrcode' && (
        <div className="mt-6 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5">
          <div className="text-sm font-medium text-sky-200 mb-3">📲 QR / link de votação</div>
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(`${window.location.origin}/votar/${votacao.id}`)}`}
              alt="QR code da votação"
              className="w-44 h-44 rounded-lg bg-white p-2 shrink-0"
            />
            <div className="flex-1 min-w-0 w-full">
              <p className="text-xs text-slate-400 mb-2">
                Exiba o QR na assembleia. Quem está logado vota pelo app; quem não está abre o link e vota por unidade.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}/votar/${votacao.id}`}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/votar/${votacao.id}`)
                    toast.success('Link copiado.')
                  }}
                >
                  Copiar
                </Button>
              </div>
              {votacao.codigo_acesso && (
                <p className="mt-3 text-xs text-slate-300">
                  Código de acesso: <strong className="font-mono tracking-wide text-sky-200">{votacao.codigo_acesso}</strong> (anuncie pros presentes)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
