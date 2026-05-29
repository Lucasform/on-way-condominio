import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  analisarOcorrenciaIA,
  getOcorrenciaIaAnalysis,
  stashIASuggestion,
  updateOcorrenciaIaAnalysis,
  type IAAnalysis,
  type IAResult,
} from '../lib/iaAnalysis'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'

interface Props {
  ocorrenciaId: string
  createdAt: string         // pra detectar análise rodando em background
  canAnalyse: boolean       // só admin/adm/sindico
  canGenerateMulta: boolean // se ocorrência está em status que permite
}

// Janela em que assumimos que o fire-and-forget do createOcorrencia ainda pode
// estar rodando. Passado isso, exibimos botão manual.
const BACKGROUND_WINDOW_MS = 5 * 60 * 1000
// Timeout pra mostrar fallback manual mesmo dentro da janela de background.
const BACKGROUND_TIMEOUT_MS = 90 * 1000

const CONFIANCA_COLOR = {
  alta: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  media: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  baixa: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

export default function AIAnalysisPanel({ ocorrenciaId, createdAt, canAnalyse, canGenerateMulta }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [loadingPersist, setLoadingPersist] = useState(true)
  const [result, setResult] = useState<IAResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [analisadaEm, setAnalisadaEm] = useState<string | null>(null)
  // Quando o background dispara fire-and-forget e ainda não voltou.
  const [waitingBackground, setWaitingBackground] = useState(false)
  const [backgroundTimedOut, setBackgroundTimedOut] = useState(false)

  // Edição manual
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<IAAnalysis | null>(null)
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  const resultRef = useRef<IAResult | null>(null)
  resultRef.current = result

  // Carrega análise persistida ao montar
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const persistida = await getOcorrenciaIaAnalysis(ocorrenciaId)
        if (!mounted) return
        if (persistida) {
          setResult({
            ocorrencia_id: ocorrenciaId,
            analysis: persistida.analysis,
            artigos_consultados: persistida.artigos_consultados,
            modelo: persistida.modelo,
            tokens: { input: null, output: null },
          })
          setAnalisadaEm(persistida.analisada_em)
        } else {
          const ageMs = Date.now() - new Date(createdAt).getTime()
          if (ageMs >= 0 && ageMs < BACKGROUND_WINDOW_MS) {
            setWaitingBackground(true)
          }
        }
      } catch (e) {
        console.warn('[AIAnalysisPanel] erro ao ler análise persistida:', e)
      } finally {
        if (mounted) setLoadingPersist(false)
      }
    })()
    return () => { mounted = false }
  }, [ocorrenciaId, createdAt])

  // Realtime: ouve UPDATE no row da ocorrência. Quando o background termina
  // e a edge grava ia_analysis, refletimos na hora sem polling.
  useEffect(() => {
    if (!waitingBackground) return
    const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
    const channel = supabase
      .channel(`ocorrencia_ia:${ocorrenciaId}:${suffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ocorrencias',
          filter: `id=eq.${ocorrenciaId}`,
        },
        async () => {
          if (resultRef.current) return
          const persistida = await getOcorrenciaIaAnalysis(ocorrenciaId)
          if (!persistida) return
          setResult({
            ocorrencia_id: ocorrenciaId,
            analysis: persistida.analysis,
            artigos_consultados: persistida.artigos_consultados,
            modelo: persistida.modelo,
            tokens: { input: null, output: null },
          })
          setAnalisadaEm(persistida.analisada_em)
          setWaitingBackground(false)
          setBackgroundTimedOut(false)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [waitingBackground, ocorrenciaId])

  // Polling de segurança: se realtime cair ou a edge demorar, tenta a cada 8s
  // por até BACKGROUND_TIMEOUT_MS; depois libera fallback manual.
  useEffect(() => {
    if (!waitingBackground) return
    const start = Date.now()
    const interval = setInterval(async () => {
      if (resultRef.current) return
      const persistida = await getOcorrenciaIaAnalysis(ocorrenciaId)
      if (persistida) {
        setResult({
          ocorrencia_id: ocorrenciaId,
          analysis: persistida.analysis,
          artigos_consultados: persistida.artigos_consultados,
          modelo: persistida.modelo,
          tokens: { input: null, output: null },
        })
        setAnalisadaEm(persistida.analisada_em)
        setWaitingBackground(false)
        setBackgroundTimedOut(false)
        return
      }
      if (Date.now() - start > BACKGROUND_TIMEOUT_MS) {
        setBackgroundTimedOut(true)
        setWaitingBackground(false)
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [waitingBackground, ocorrenciaId])

  if (!canAnalyse) return null

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setEditando(false)
    setWaitingBackground(false)
    setBackgroundTimedOut(false)
    try {
      const r = await analisarOcorrenciaIA(ocorrenciaId, comentario.trim() || undefined)
      setResult(r)
      setAnalisadaEm(new Date().toISOString())
      setComentario('')
      setShowComment(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na análise.')
    } finally {
      setLoading(false)
    }
  }

  function handleEditar() {
    if (!result) return
    setEditForm({ ...result.analysis })
    setEditando(true)
  }

  async function handleSalvarEdit() {
    if (!editForm || !result) return
    setSalvandoEdit(true)
    setError(null)
    try {
      await updateOcorrenciaIaAnalysis(ocorrenciaId, editForm)
      setResult({ ...result, analysis: editForm })
      setEditando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar edição.')
    } finally {
      setSalvandoEdit(false)
    }
  }

  function handleApprove() {
    if (!result || !result.analysis.cabe_multa) return
    const a = result.analysis
    stashIASuggestion({
      ocorrencia_id: ocorrenciaId,
      artigo: a.artigo_aplicavel ?? '',
      valor: a.valor_sugerido_reais ?? 0,
      descricao: a.minuta,
      origem: 'ia',
      modelo: result.modelo,
    })
    navigate(`/multas/nova?ocorrencia=${ocorrenciaId}&fromIA=1`)
  }

  if (loadingPersist) {
    return (
      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-500">
        Carregando análise...
      </div>
    )
  }

  const subtitle = analisadaEm
    ? `Última análise em ${new Date(analisadaEm).toLocaleString('pt-BR')}.`
    : waitingBackground
      ? 'Análise rodando em segundo plano. A multa é montada automaticamente quando o agente termina.'
      : 'Análise com base no regimento e histórico da unidade. Apenas sugestão.'

  return (
    <div className="mt-6 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium text-sky-200">🧑‍💼 Análise do Gestor</div>
          <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
        </div>
        <div className="flex gap-2 items-start flex-wrap">
          {!showComment && !editando && (result || backgroundTimedOut) && (
            <Button variant="ghost" onClick={() => setShowComment(true)} disabled={loading}>
              + Comentário
            </Button>
          )}
          {!result && !showComment && !waitingBackground && (
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? 'Analisando...' : backgroundTimedOut ? 'Analisar agora' : 'Analisar'}
            </Button>
          )}
          {result && !showComment && !editando && (
            <>
              <Button variant="ghost" onClick={handleEditar}>
                ✎ Editar
              </Button>
              <Button variant="ghost" onClick={handleAnalyze} disabled={loading}>
                {loading ? '...' : '🔄 Reanalisar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {showComment && (
        <div className="mb-3">
          <label className="block text-xs text-slate-400 mb-1">
            {result
              ? 'Comentário pra reanálise (opcional). Diga o que mudou ou o que considerar.'
              : 'Comentário adicional (ex.: considere reincidência, valor = 1% do salário mínimo).'}
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="Instruções extras pra esta análise..."
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-sky-500 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? 'Analisando...' : (result ? '🔄 Reanalisar agora' : 'Analisar')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setShowComment(false); setComentario('') }}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="text-sm text-slate-400 italic">
          Aguardando análise... Aguarde um momento
        </div>
      )}

      {waitingBackground && !loading && !result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-sky-200">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            Analisando em segundo plano…
          </div>
          <div className="space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-800/70 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-slate-800/70 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-slate-800/70 animate-pulse" />
          </div>
          <div className="text-xs text-slate-500">
            Pode levar alguns segundos. A tela atualiza sozinha quando o agente terminar.
          </div>
        </div>
      )}

      {backgroundTimedOut && !loading && !result && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          A análise em segundo plano demorou mais que o esperado. Clique em <strong>Analisar agora</strong> pra rodar manualmente.
        </div>
      )}

      {/* Modo edição manual */}
      {result && editando && editForm && (
        <div className="space-y-3 mt-2">
          <div className="text-xs text-slate-400 italic">
            Editando a análise. O conteúdo abaixo será salvo na ocorrência e usado ao gerar notificação ou multa.
          </div>
          <FieldEdit label="Cabe sanção">
            <select
              value={editForm.cabe_multa ? 'sim' : 'nao'}
              onChange={(e) => setEditForm({ ...editForm, cabe_multa: e.target.value === 'sim' })}
              className={inputCls}
            >
              <option value="sim">Sim, cabe</option>
              <option value="nao">Não cabe</option>
            </select>
          </FieldEdit>
          <FieldEdit label="Artigo aplicável">
            <input
              value={editForm.artigo_aplicavel ?? ''}
              onChange={(e) => setEditForm({ ...editForm, artigo_aplicavel: e.target.value || null })}
              className={inputCls}
              placeholder="Ex.: Art. 12"
            />
          </FieldEdit>
          <FieldEdit label="Tipo de infração">
            <input
              value={editForm.tipo_infracao}
              onChange={(e) => setEditForm({ ...editForm, tipo_infracao: e.target.value })}
              className={inputCls}
            />
          </FieldEdit>
          <FieldEdit label="Valor sugerido (R$)">
            <input
              type="number" step="0.01" min="0"
              value={editForm.valor_sugerido_reais ?? ''}
              onChange={(e) => setEditForm({ ...editForm, valor_sugerido_reais: e.target.value ? Number(e.target.value) : null })}
              className={inputCls}
            />
          </FieldEdit>
          <FieldEdit label="Confiança">
            <select
              value={editForm.confianca}
              onChange={(e) => setEditForm({ ...editForm, confianca: e.target.value as IAAnalysis['confianca'] })}
              className={inputCls}
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </FieldEdit>
          <FieldEdit label="Justificativa">
            <textarea
              value={editForm.justificativa}
              onChange={(e) => setEditForm({ ...editForm, justificativa: e.target.value })}
              rows={3}
              className={inputCls}
            />
          </FieldEdit>
          <FieldEdit label="Minuta (texto que vai pra notificação ou multa)">
            <textarea
              value={editForm.minuta}
              onChange={(e) => setEditForm({ ...editForm, minuta: e.target.value })}
              rows={6}
              className={inputCls}
            />
          </FieldEdit>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSalvarEdit} disabled={salvandoEdit}>
              {salvandoEdit ? 'Salvando...' : '✓ Salvar edição'}
            </Button>
            <Button variant="ghost" onClick={() => { setEditando(false); setEditForm(null) }} disabled={salvandoEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Modo visualização */}
      {result && !editando && (
        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 flex-wrap">
            <span
              className={`shrink-0 px-3 py-1 rounded text-xs font-semibold border ${
                result.analysis.cabe_multa
                  ? 'bg-red-500/15 text-red-300 border-red-500/40'
                  : 'bg-slate-700/40 text-slate-300 border-slate-700'
              }`}
            >
              {result.analysis.cabe_multa ? '⚠ Cabe sanção' : '✓ Não cabe sanção'}
            </span>
            <span className={`shrink-0 px-2 py-1 rounded text-xs border ${CONFIANCA_COLOR[result.analysis.confianca]}`}>
              confiança: {result.analysis.confianca}
            </span>
          </div>

          {result.analysis.cabe_multa && (
            <dl className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-y-2 gap-x-4 text-sm">
              <dt className="text-slate-500">Artigo</dt>
              <dd className="text-slate-100">{result.analysis.artigo_aplicavel ?? '—'}</dd>
              <dt className="text-slate-500">Infração</dt>
              <dd className="text-slate-100">{result.analysis.tipo_infracao}</dd>
              <dt className="text-slate-500">Valor sugerido</dt>
              <dd className="text-slate-100 font-semibold">
                R$ {result.analysis.valor_sugerido_reais?.toFixed(2).replace('.', ',') ?? '—'}
              </dd>
            </dl>
          )}

          <div className="border-t border-sky-500/20 pt-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Justificativa
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.analysis.justificativa}</p>
          </div>

          {result.analysis.cabe_multa && (
            <div className="border-t border-sky-500/20 pt-3">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Minuta (vai pro texto da notificação ou multa)
              </div>
              <div className="bg-slate-950/60 border border-slate-700 rounded-md p-3 text-sm text-slate-200 whitespace-pre-wrap">
                {result.analysis.minuta}
              </div>
            </div>
          )}

          {(() => {
            const textoAnalise = [
              result.analysis.artigo_aplicavel ?? '',
              result.analysis.justificativa ?? '',
              result.analysis.minuta ?? '',
            ].join(' ').toLowerCase()
            const citados = result.artigos_consultados.filter((a) => {
              if (!a.numero) return false
              const num = String(a.numero).toLowerCase().replace(/[º°o]/g, '').trim()
              if (!num) return false
              const re = new RegExp(`\\bart(?:igo)?\\.?\\s*${num}[ºo°]?\\b`, 'i')
              return re.test(textoAnalise)
            })
            if (citados.length === 0) return null
            return (
              <div className="border-t border-sky-500/20 pt-3">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Artigos citados
                </div>
                <ul className="space-y-3">
                  {citados.map((a) => (
                    <li key={a.id} className="text-xs">
                      <div className="text-slate-400">
                        <span className="font-mono text-slate-500">[{a.numero ?? 's/n'}]</span>{' '}
                        <span className="text-slate-300">{a.titulo}</span>
                      </div>
                      {a.conteudo && (
                        <p className="mt-1 text-slate-400 whitespace-pre-wrap leading-relaxed">
                          {a.conteudo}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}

          {result.analysis.cabe_multa && canGenerateMulta && (
            <div className="border-t border-sky-500/20 pt-4 flex items-center gap-3 flex-wrap">
              <Button onClick={handleApprove}>
                ✓ Aprovar e gerar multa
              </Button>
              <span className="text-xs text-slate-500">
                Vai abrir o form de multa pré-preenchido com a análise.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-sky-500 focus:outline-none'

function FieldEdit({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  )
}
