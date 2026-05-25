import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import { listPessoas } from '../lib/pessoas'
import { createEncomenda } from '../lib/encomendas'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { EncomendaInput, TipoEncomenda } from '../types/encomenda'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const EMPTY: EncomendaInput = {
  condominio_id: '',
  unidade_id: '',
  pessoa_id: null,
  tipo: 'encomenda',
  transportadora: null,
  codigo_rastreio: null,
  descricao: null,
  local_armazenamento: null,
  foto_url: null,
  observacoes: null,
}

export default function EncomendaNova() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway'

  const [form, setForm] = useState<EncomendaInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then(setCondos).catch(() => {})
    } else if (perfil?.condominio_id) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil])

  useEffect(() => {
    if (!form.condominio_id) {
      setUnidades([])
      setPessoas([])
      return
    }
    listUnidades({ condominio_id: form.condominio_id, ativo: true }).then(setUnidades).catch(() => {})
    listPessoas({ condominio_id: form.condominio_id, ativo: true }).then(setPessoas).catch(() => {})
  }, [form.condominio_id])

  function update<K extends keyof EncomendaInput>(key: K, value: EncomendaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.unidade_id) return setError('Selecione a unidade destinatária.')
    setSubmitting(true)
    setError(null)
    try {
      await createEncomenda(form, user.id)
      navigate('/encomendas')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar.')
    } finally {
      setSubmitting(false)
    }
  }

  const pessoasDaUnidade = form.unidade_id
    ? pessoas.filter((p) => p.unidade_id === form.unidade_id)
    : []

  // Comida: layout simplificado (sem armazenamento, sem rastreio — entrega imediata)
  const isComida = form.tipo === 'comida'

  return (
    <div className="px-8 py-10 max-w-2xl">
      <PageHeader
        title="Registrar encomenda"
        subtitle="Pacote, comida, documento ou outro item recebido na portaria."
        actions={
          <Link to="/encomendas">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Tipo" required>
          <div className="grid grid-cols-4 gap-2">
            {(['encomenda', 'comida', 'documento', 'outro'] as TipoEncomenda[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update('tipo', t)}
                className={`px-3 py-2 rounded-md text-sm border transition ${
                  form.tipo === t
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                {t === 'encomenda' && '📦 Encomenda'}
                {t === 'comida' && '🍔 Comida'}
                {t === 'documento' && '📄 Documento'}
                {t === 'outro' && '📬 Outro'}
              </button>
            ))}
          </div>
        </Field>

        {isAdmin && (
          <Field label="Condomínio" required>
            <Select
              required
              value={form.condominio_id}
              onChange={(e) => {
                update('condominio_id', e.target.value)
                update('unidade_id', '')
                update('pessoa_id', null)
              }}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Unidade destinatária" required>
          <Select
            required
            value={form.unidade_id}
            onChange={(e) => {
              update('unidade_id', e.target.value)
              update('pessoa_id', null)
            }}
            disabled={!form.condominio_id}
          >
            <option value="">Selecione...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Pessoa destinatária (opcional)" hint="Se a encomenda é nominada a alguém específico.">
          <Select
            value={form.pessoa_id ?? ''}
            onChange={(e) => update('pessoa_id', e.target.value || null)}
            disabled={!form.unidade_id || pessoasDaUnidade.length === 0}
          >
            <option value="">— Não especificada</option>
            {pessoasDaUnidade.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Select>
        </Field>

        {!isComida && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Transportadora">
                <TextInput
                  value={form.transportadora ?? ''}
                  onChange={(e) => update('transportadora', e.target.value)}
                  placeholder="Correios, Mercado Livre, iFood..."
                />
              </Field>
              <Field label="Código de rastreio">
                <TextInput
                  value={form.codigo_rastreio ?? ''}
                  onChange={(e) => update('codigo_rastreio', e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>

            <Field label="Local de armazenamento" hint='Ex: "Armário 12", "Recepção", "Sala da portaria"'>
              <TextInput
                value={form.local_armazenamento ?? ''}
                onChange={(e) => update('local_armazenamento', e.target.value)}
              />
            </Field>
          </>
        )}

        <Field label="Descrição">
          <TextArea
            rows={2}
            value={form.descricao ?? ''}
            onChange={(e) => update('descricao', e.target.value)}
            placeholder={
              isComida
                ? 'Ex: iFood, McDonalds, pedido #12345'
                : 'Caixa pequena, envelope, etc.'
            }
          />
        </Field>

        {isComida && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
            ⚡ <strong>Comida = entrega imediata.</strong> O morador deve buscar agora.
            Aviso instantâneo (via chat / e-mail) virá com a Fase 4 — por enquanto registra e chama o morador.
          </div>
        )}

        <Field label="Observações internas">
          <TextArea
            rows={2}
            value={form.observacoes ?? ''}
            onChange={(e) => update('observacoes', e.target.value)}
            placeholder="Notas pra outros da portaria."
          />
        </Field>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar'}
          </Button>
          <Link to="/encomendas">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
