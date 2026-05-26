import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analisarOcorrenciaIA, stashIASuggestion, type IAResult } from '../lib/iaAnalysis'
import Button from './ui/Button'

interface Props {
  ocorrenciaId: string
  canAnalyse: boolean   // só admin/adm/sindico
  canGenerateMulta: boolean  // se ocorrência está em status que permite
}

const CONFIANCA_COLOR = {
  alta: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  media: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  baixa: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

export default function AIAnalysisPanel({ ocorrenciaId, canAnalyse, canGenerateMulta }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IAResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!canAnalyse) return null

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await analisarOcorrenciaIA(ocorrenciaId)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na análise.')
    } finally {
      setLoading(false)
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

  return (
    <div className="mt-6 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <div className="text-sm font-medium text-sky-200">🤖 Análise por IA</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Claude Sonnet 4.6 lê a ocorrência + regimento e sugere se cabe multa.
            Apenas sugestão. Você decide.
          </div>
        </div>
        {!result && (
          <Button onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analisando...' : 'Analisar com IA'}
          </Button>
        )}
        {result && (
          <Button variant="ghost" onClick={handleAnalyze} disabled={loading}>
            {loading ? '...' : '🔄 Reanalisar'}
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="text-sm text-slate-400 italic">
          Aguardando análise... (pode levar 5–15s na primeira vez)
        </div>
      )}

      {result && (
        <div className="space-y-4 mt-2">
          {/* Resultado principal */}
          <div className="flex items-start gap-3">
            <span
              className={`shrink-0 px-3 py-1 rounded text-xs font-semibold border ${
                result.analysis.cabe_multa
                  ? 'bg-red-500/15 text-red-300 border-red-500/40'
                  : 'bg-slate-700/40 text-slate-300 border-slate-700'
              }`}
            >
              {result.analysis.cabe_multa ? '⚠ Cabe multa' : '✓ Não cabe multa'}
            </span>
            <span className={`shrink-0 px-2 py-1 rounded text-xs border ${CONFIANCA_COLOR[result.analysis.confianca]}`}>
              confiança: {result.analysis.confianca}
            </span>
          </div>

          {/* Dados da multa sugerida */}
          {result.analysis.cabe_multa && (
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-4 text-sm">
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

          {/* Justificativa */}
          <div className="border-t border-sky-500/20 pt-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Justificativa
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{result.analysis.justificativa}</p>
          </div>

          {/* Minuta */}
          {result.analysis.cabe_multa && (
            <div className="border-t border-sky-500/20 pt-3">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Minuta sugerida (você pode editar antes de enviar)
              </div>
              <div className="bg-slate-950/60 border border-slate-700 rounded-md p-3 text-sm text-slate-200 whitespace-pre-wrap">
                {result.analysis.minuta}
              </div>
            </div>
          )}

          {/* Artigos consultados */}
          <div className="border-t border-sky-500/20 pt-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Artigos consultados (RAG, top {result.artigos_consultados.length})
            </div>
            <ul className="space-y-1">
              {result.artigos_consultados.map((a) => (
                <li key={a.id} className="text-xs text-slate-400">
                  <span className="font-mono text-slate-500">[{a.numero ?? 's/n'}]</span>{' '}
                  {a.titulo}
                  <span className="text-slate-600 ml-2">· similarity {a.similarity.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Ação aprovar */}
          {result.analysis.cabe_multa && canGenerateMulta && (
            <div className="border-t border-sky-500/20 pt-4 flex items-center gap-3">
              <Button onClick={handleApprove}>
                ✓ Aprovar e gerar multa
              </Button>
              <span className="text-xs text-slate-500">
                Vai abrir o form de multa pré-preenchido. Você ainda pode ajustar tudo.
              </span>
            </div>
          )}

          {/* Metadados */}
          <div className="text-[10px] text-slate-600">
            {result.modelo} · {result.tokens.input} tokens entrada · {result.tokens.output} tokens saída
          </div>
        </div>
      )}
    </div>
  )
}
