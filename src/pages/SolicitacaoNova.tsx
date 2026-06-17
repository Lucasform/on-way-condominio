import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSolicitacao } from '../lib/solicitacoes'
import type { TipoSolicitacao } from '../types/solicitacao'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'

const TIPOS: { value: TipoSolicitacao; label: string }[] = [
  { value: 'duvida',     label: 'Dúvida' },
  { value: 'reclamacao', label: 'Reclamação' },
  { value: 'sugestao',   label: 'Sugestão' },
  { value: 'outros',     label: 'Outros' },
]

export default function SolicitacaoNova() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [tipo, setTipo] = useState<TipoSolicitacao>('duvida')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !perfil?.condominio_id) return
    if (!titulo.trim() || !descricao.trim()) {
      toast.error('Preencha título e descrição.')
      return
    }

    setSaving(true)
    try {
      const s = await createSolicitacao(
        {
          condominio_id: perfil.condominio_id,
          tipo,
          titulo,
          descricao,
        },
        user.id,
      )
      toast.success('Solicitação enviada.')
      navigate(`/solicitacoes/${s.id}`)
    } catch (e) {
      toast.error('Erro ao enviar', e instanceof Error ? e.message : '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
      <PageHeader
        title="Nova solicitação"
        subtitle="Envie sua dúvida, reclamação ou sugestão."
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSolicitacao)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Título" hint="Resumo curto da solicitação">
          <TextInput
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Vazamento no corredor do 3º andar"
            maxLength={120}
            required
          />
        </Field>

        <Field label="Descrição" hint="Descreva com detalhes para que a gestão possa ajudar">
          <TextArea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe sua solicitação aqui..."
            rows={6}
            required
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Enviando...' : 'Enviar solicitação'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
