import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

const TIPO_INFO: Record<TipoEncomenda, { titulo: string; emoji: string; descricao: string }> = {
  encomenda: {
    titulo: 'Encomenda',
    emoji: '📦',
    descricao: 'Pacote, caixa ou envelope que será guardado pra retirada.',
  },
  comida: {
    titulo: 'Comida',
    emoji: '🍔',
    descricao: 'iFood, delivery ou refeição que precisa ser entregue agora.',
  },
  documento: {
    titulo: 'Documento',
    emoji: '📄',
    descricao: 'Cartas, boletos ou correspondências.',
  },
  outro: {
    titulo: 'Outro',
    emoji: '📬',
    descricao: 'Qualquer outro item recebido na portaria.',
  },
}

function parseTipo(v: string | null): TipoEncomenda | null {
  if (v === 'encomenda' || v === 'comida' || v === 'documento' || v === 'outro') return v
  return null
}

export default function EncomendaNova() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const [params, setParams] = useSearchParams()
  const tipoUrl = parseTipo(params.get('tipo'))

  const [form, setForm] = useState<EncomendaInput>({ ...EMPTY, tipo: tipoUrl ?? 'encomenda' })
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
  const infoAtual = TIPO_INFO[form.tipo]

  function escolherTipo(t: TipoEncomenda) {
    update('tipo', t)
    setParams({ tipo: t }, { replace: true })
  }

  function voltarParaSelecao() {
    setParams({}, { replace: true })
  }

  // Tela inicial: cards de seleção do tipo
  if (!tipoUrl) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
        <PageHeader
          title="Registrar"
          subtitle="O que chegou na portaria?"
          actions={
            <Link to="/encomendas">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['encomenda', 'comida', 'documento', 'outro'] as TipoEncomenda[]).map((t) => {
            const info = TIPO_INFO[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => escolherTipo(t)}
                className="text-left rounded-lg border border-slate-800 bg-slate-900/40 p-5 hover:border-emerald-500 hover:bg-emerald-500/5 transition group"
              >
                <div className="text-3xl mb-2">{info.emoji}</div>
                <div className="text-base font-semibold text-slate-100 group-hover:text-emerald-200">
                  {info.titulo}
                </div>
                <div className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {info.descricao}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
      <PageHeader
        title={`Registrar ${infoAtual.titulo.toLowerCase()}`}
        subtitle={infoAtual.descricao}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={voltarParaSelecao}>← Trocar tipo</Button>
            <Link to="/encomendas">
              <Button variant="ghost">Sair</Button>
            </Link>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
