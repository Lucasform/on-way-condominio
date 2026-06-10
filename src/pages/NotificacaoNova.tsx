import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createNotificacao } from '../lib/notificacoes'
import { listUnidades } from '../lib/unidades'
import { listPessoas } from '../lib/pessoas'
import { getOcorrencia, updateOcorrenciaStatus } from '../lib/ocorrencias'
import { getOcorrenciaIaAnalysis } from '../lib/iaAnalysis'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, Select } from '../components/ui/Input'
import { traduzErro } from '../lib/errorMessages'

export default function NotificacaoNova() {
  const { perfil, user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ocorrenciaId = params.get('ocorrencia')

  const [form, setForm] = useState({
    unidade_id: '',
    pessoa_id: '',
    assunto: '',
    descricao: '',
    artigo_regimento: '',
    observacoes: '',
  })

  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ocorrenciaId) return
    listUnidades().then(setUnidades).catch(() => {})
    listPessoas().then(setPessoas).catch(() => {})
  }, [ocorrenciaId])

  // Notificacao so pode ser emitida a partir de uma ocorrencia (mesmo padrao da multa).
  if (!ocorrenciaId) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
        <PageHeader
          title="Nova notificação"
          actions={<Link to="/notificacoes"><Button variant="ghost">← Voltar</Button></Link>}
        />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-200 space-y-3">
          <div>
            <strong>Notificações são emitidas a partir de uma ocorrência.</strong>
          </div>
          <div className="text-amber-100/90">
            Registre a ocorrência primeiro e, depois da análise, escolha "Emitir notificação" no card de desfecho.
          </div>
          <div className="pt-2">
            <Link to="/ocorrencias">
              <Button>Ir para ocorrências →</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Pré-popula a partir da ocorrência + análise persistida da IA (se houver)
  useEffect(() => {
    if (!ocorrenciaId) return
    ;(async () => {
      try {
        const o = await getOcorrencia(ocorrenciaId)
        if (!o) return
        const ia = await getOcorrenciaIaAnalysis(ocorrenciaId)
        const usarIa = !!ia
        setForm((f) => ({
          ...f,
          unidade_id: o.unidade_id ?? '',
          descricao: usarIa && ia.analysis.minuta
            ? ia.analysis.minuta
            : `Foi registrada a seguinte ocorrência: "${o.descricao}". ${o.local ? `Local: ${o.local}. ` : ''}Solicitamos a regularização imediata e atenção às normas do condomínio.`,
          assunto: f.assunto || (usarIa && ia.analysis.tipo_infracao ? `Notificação: ${ia.analysis.tipo_infracao}` : 'Advertência por descumprimento de norma interna'),
          artigo_regimento: f.artigo_regimento || (usarIa ? ia.analysis.artigo_aplicavel ?? '' : ''),
          observacoes: f.observacoes || (usarIa ? ia.analysis.justificativa : ''),
        }))
      } catch { /* ignora */ }
    })()
  }, [ocorrenciaId])

  const pessoasUnidade = pessoas.filter((p) => p.unidade_id === form.unidade_id)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!perfil?.condominio_id && perfil?.role !== 'admin_onway') {
      setError('Sem condomínio associado.')
      return
    }
    if (!form.unidade_id) { setError('Selecione a unidade.'); return }
    if (!form.assunto.trim() || !form.descricao.trim()) {
      setError('Preencha assunto e descrição.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const unidade = unidades.find((u) => u.id === form.unidade_id)
      if (!unidade) throw new Error('Unidade inválida.')
      const n = await createNotificacao({
        condominio_id: unidade.condominio_id,
        unidade_id: form.unidade_id,
        pessoa_id: form.pessoa_id || null,
        ocorrencia_id: ocorrenciaId || null,
        assunto: form.assunto,
        descricao: form.descricao,
        artigo_regimento: form.artigo_regimento || null,
        observacoes: form.observacoes || null,
      }, user!.id)

      // Se veio de ocorrência, marca como em_analise (mantém ligada)
      if (ocorrenciaId) {
        await updateOcorrenciaStatus(ocorrenciaId, 'em_analise').catch(() => {})
      }

      navigate(`/notificacoes/${n.id}`, { replace: true })
    } catch (e) {
      setError(traduzErro(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
      <PageHeader
        title="Nova notificação"
        actions={<Link to="/notificacoes"><Button variant="ghost">← Voltar</Button></Link>}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Unidade" required>
          <Select required value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value, pessoa_id: '' })}>
            <option value="">Selecione...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
              </option>
            ))}
          </Select>
        </Field>

        {pessoasUnidade.length > 0 && (
          <Field label="Pessoa (opcional)">
            <Select value={form.pessoa_id} onChange={(e) => setForm({ ...form, pessoa_id: e.target.value })}>
              <option value="">— Notificar a unidade —</option>
              {pessoasUnidade.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Assunto" required>
          <TextInput
            required
            value={form.assunto}
            onChange={(e) => setForm({ ...form, assunto: e.target.value })}
            placeholder="Ex: Advertência por barulho excessivo"
          />
        </Field>

        <Field label="Descrição" required>
          <textarea
            required
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            rows={5}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm"
          />
        </Field>

        <Field label="Base no regimento (opcional)">
          <TextInput
            value={form.artigo_regimento}
            onChange={(e) => setForm({ ...form, artigo_regimento: e.target.value })}
            placeholder="Ex: Art. 12 § 3º — Silêncio entre 22h e 8h"
          />
        </Field>

        <Field label="Observações internas (opcional)">
          <textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
          />
        </Field>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Emitir notificação'}
          </Button>
          <Link to="/notificacoes"><Button variant="secondary" type="button">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
