import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { getOcorrencia } from '../lib/ocorrencias'
import { getUnidade } from '../lib/unidades'
import { getPessoa } from '../lib/pessoas'
import { createMultaFromOcorrencia } from '../lib/multas'
import { vincularMultaNotificacao } from '../lib/notificacoes'
import { clearIASuggestion, getOcorrenciaIaAnalysis, readIASuggestion } from '../lib/iaAnalysis'
import type { Ocorrencia } from '../types/ocorrencia'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea } from '../components/ui/Input'

interface FormState {
  valor: string // string pra deixar o input controlado; convertido pra number no submit
  artigo_regimento: string
  descricao: string
  observacoes: string
  vencimento_em: string  // 'YYYY-MM-DD'
}

const EMPTY: FormState = {
  valor: '',
  artigo_regimento: '',
  descricao: '',
  observacoes: '',
  vencimento_em: defaultVencimento(),
}

function defaultVencimento(): string {
  // Default = hoje + 30 dias (boleto subsequente)
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

export default function MultaNova() {
  const [params] = useSearchParams()
  const ocorrenciaId = params.get('ocorrencia')
  const notificacaoId = params.get('notificacao')
  const navigate = useNavigate()
  const { user, perfil } = useAuth()

  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [pessoaEnvolvida, setPessoaEnvolvida] = useState<Pessoa | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usouIA, setUsouIA] = useState(false)

  useEffect(() => {
    if (!ocorrenciaId) {
      setError('Esta tela só pode ser aberta a partir de uma ocorrência.')
      setLoading(false)
      return
    }
    let mounted = true
    ;(async () => {
      try {
        const o = await getOcorrencia(ocorrenciaId)
        if (!mounted) return
        if (!o) {
          setError('Ocorrência não encontrada.')
          setLoading(false)
          return
        }
        setOcorrencia(o)

        // 1) Tenta análise persistida no banco (mais confiável, sobrevive entre sessões)
        const persistida = await getOcorrenciaIaAnalysis(o.id)
        const stashed = readIASuggestion(o.id)
        if (persistida?.analysis.cabe_multa) {
          const a = persistida.analysis
          setForm((f) => ({
            ...f,
            valor: a.valor_sugerido_reais != null ? String(a.valor_sugerido_reais) : '',
            artigo_regimento: a.artigo_aplicavel ?? '',
            descricao: a.minuta || o.descricao,
            observacoes: a.justificativa ?? '',
          }))
          setUsouIA(true)
          clearIASuggestion()
        } else if (stashed) {
          setForm((f) => ({
            ...f,
            valor: String(stashed.valor),
            artigo_regimento: stashed.artigo,
            descricao: stashed.descricao,
          }))
          setUsouIA(true)
          clearIASuggestion()
        } else {
          setForm((f) => ({ ...f, descricao: o.descricao }))
        }

        const [un, pe] = await Promise.all([
          o.unidade_id ? getUnidade(o.unidade_id) : Promise.resolve(null),
          o.pessoa_envolvida_id ? getPessoa(o.pessoa_envolvida_id) : Promise.resolve(null),
        ])
        if (mounted) {
          setUnidade(un)
          setPessoaEnvolvida(pe)
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Erro ao carregar.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [ocorrenciaId])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !ocorrencia) return
    if (!unidade) return setError('Ocorrência sem unidade associada — vincule uma unidade antes de gerar multa.')

    const valorNum = parseFloat(form.valor.replace(',', '.'))
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      return setError('Informe um valor válido.')
    }
    if (!form.descricao.trim()) {
      return setError('Descrição é obrigatória.')
    }

    setSubmitting(true)
    setError(null)
    try {
      const multa = await createMultaFromOcorrencia(
        {
          condominio_id: ocorrencia.condominio_id,
          unidade_id: unidade.id,
          pessoa_id: pessoaEnvolvida?.id ?? null,
          ocorrencia_id: ocorrencia.id,
          valor: valorNum,
          artigo_regimento: form.artigo_regimento,
          descricao: form.descricao,
          observacoes: form.observacoes,
          vencimento_em: form.vencimento_em || null,
        },
        user.id,
      )
      if (notificacaoId) {
        await vincularMultaNotificacao(notificacaoId, multa.id).catch(() => {})
        navigate(`/notificacoes/${notificacaoId}`, { replace: true })
      } else {
        navigate(`/ocorrencias/${ocorrencia.id}`, { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar multa.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>

  if (!perfil || !['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader title="Gerar multa" actions={<Link to="/ocorrencias"><Button variant="ghost">← Voltar</Button></Link>} />
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          Apenas admin OnWay, administradora e síndico podem gerar multas.
        </div>
      </div>
    )
  }

  if (error && !ocorrencia) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader title="Gerar multa" actions={<Link to="/ocorrencias"><Button variant="ghost">← Voltar</Button></Link>} />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      </div>
    )
  }

  if (!ocorrencia) return null

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
      {usouIA && (
        <div className="mb-4 rounded-md border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm text-sky-100">
          🤖 <strong>Pré-preenchido pela IA</strong> a partir da análise da ocorrência. Revise e ajuste se necessário antes de gerar.
        </div>
      )}
      <PageHeader
        title="Gerar multa"
        subtitle="A partir da ocorrência registrada."
        actions={
          <Link to={`/ocorrencias/${ocorrencia.id}`}>
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm space-y-1">
        <div className="text-slate-500 text-xs uppercase tracking-wide">Ocorrência origem</div>
        <div className="text-slate-300">
          {new Date(ocorrencia.created_at).toLocaleString('pt-BR')} ·{' '}
          {unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : 'Área comum'}
          {ocorrencia.local && ` · ${ocorrencia.local}`}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Valor (R$)" required hint="Decimal com ponto ou vírgula.">
          <TextInput
            required
            inputMode="decimal"
            value={form.valor}
            onChange={(e) => update('valor', e.target.value)}
            placeholder="150.00"
          />
        </Field>

        <Field label="Artigo do regimento" hint='Texto livre por enquanto. Ex: "Art. 18, §2º — uso de áreas comuns"'>
          <TextInput
            value={form.artigo_regimento}
            onChange={(e) => update('artigo_regimento', e.target.value)}
          />
        </Field>

        <Field label="Vencimento" hint="Data limite pra quitação. Lembrete automatico 3 dias antes.">
          <TextInput
            type="date"
            value={form.vencimento_em}
            onChange={(e) => update('vencimento_em', e.target.value)}
            onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </Field>

        <Field label="Descrição da multa" required hint="Pré-preenchido com a descrição da ocorrência. Ajuste se necessário.">
          <TextArea
            required
            rows={4}
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
          />
        </Field>

        <Field label="Observações internas (opcional)">
          <TextArea
            rows={2}
            value={form.observacoes}
            onChange={(e) => update('observacoes', e.target.value)}
            placeholder="Anotações que não serão enviadas ao morador."
          />
        </Field>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2">
          Ao gerar, a multa entra em status <span className="text-slate-300">"em análise"</span> e a ocorrência
          origem passa pra <span className="text-slate-300">"virou multa"</span>.
        </div>

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Gerando...' : 'Gerar multa'}
          </Button>
          <Link to={`/ocorrencias/${ocorrencia.id}`}>
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
