import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { createAcesso, getMyUnidadeIds } from '../lib/acessos'
import { listUnidades } from '../lib/unidades'
import { isStaff } from '../lib/permissions'
import type { Unidade } from '../types/unidade'
import type { TipoAcesso } from '../types/acesso'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea } from '../components/ui/Input'

const TIPO_LABEL: Record<TipoAcesso, string> = {
  visitante: '👤 Visitantes',
  prestador: '🛠 Prestadores',
  entregador: '🛵 Entregadores',
  familiar: '👨‍👩‍👧 Familiares',
  fixo: '🔁 Recorrentes',
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}

function fromLocalInput(v: string): string {
  if (!v) return ''
  return new Date(v).toISOString()
}

interface ResultadoLinha {
  nome: string
  status: 'ok' | 'erro'
  motivo?: string
}

export default function AcessoEvento() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const staff = isStaff(perfil?.role)

  const [condominioId, setCondominioId] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [tipo, setTipo] = useState<TipoAcesso>('visitante')
  const [vigenciaInicio, setVigenciaInicio] = useState(toLocalInput(new Date().toISOString()))
  const [vigenciaFim, setVigenciaFim] = useState('')
  const [observacao, setObservacao] = useState('')
  const [lista, setLista] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoLinha[] | null>(null)

  useEffect(() => {
    if (!user || !perfil?.condominio_id) return
    const condo = perfil.condominio_id
    setCondominioId(condo)
    if (staff) {
      listUnidades({ condominio_id: condo, ativo: true }).then(setUnidades).catch(() => {})
    } else {
      ;(async () => {
        const myIds = await getMyUnidadeIds(condo, user.id)
        const all = await listUnidades({ condominio_id: condo, ativo: true })
        const mine = all.filter((u) => myIds.includes(u.id))
        setUnidades(mine)
        if (mine.length === 1) setUnidadeId(mine[0].id)
      })().catch(() => {})
    }
  }, [user, perfil, staff])

  function nomesLimpos(): string[] {
    return lista
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!condominioId) return setError('Condomínio não identificado.')
    if (!unidadeId) return setError('Selecione a unidade.')
    const nomes = nomesLimpos()
    if (nomes.length === 0) return setError('Cole ao menos um nome (1 por linha).')
    if (nomes.length > 50) return setError('Máximo 50 nomes por evento.')

    setSubmitting(true)
    setError(null)
    const out: ResultadoLinha[] = []
    const inicio = vigenciaInicio ? fromLocalInput(vigenciaInicio) : new Date().toISOString()
    const fim = vigenciaFim ? fromLocalInput(vigenciaFim) : null

    for (const nome of nomes) {
      try {
        await createAcesso(
          {
            condominio_id: condominioId,
            unidade_id: unidadeId,
            nome,
            tipo,
            modalidade_vigencia: fim ? 'periodo' : 'indefinido',
            vigencia_inicio: inicio,
            vigencia_fim: fim,
            observacao: observacao.trim() || null,
          },
          user.id,
        )
        out.push({ nome, status: 'ok' })
      } catch (e2) {
        out.push({
          nome,
          status: 'erro',
          motivo: e2 instanceof Error ? e2.message : 'Erro desconhecido',
        })
      }
    }
    setResultado(out)
    setSubmitting(false)
  }

  const okCount = resultado?.filter((r) => r.status === 'ok').length ?? 0
  const erroCount = resultado?.filter((r) => r.status === 'erro').length ?? 0

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Liberar acesso em lote"
        subtitle="Aniversário, reunião, mudança — autorize vários nomes de uma só vez."
        actions={
          <Link to="/acessos">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      {!resultado ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6"
        >
          <Field label="Unidade" required>
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              disabled={unidades.length === 0}
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">— Selecione —</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo de acesso" required>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAcesso)}
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-500 focus:outline-none"
            >
              {(Object.keys(TIPO_LABEL) as TipoAcesso[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Nomes (1 por linha)"
            hint="Cole a lista de convidados. Até 50 por evento."
            required
          >
            <TextArea
              value={lista}
              onChange={(e) => setLista(e.target.value)}
              rows={8}
              placeholder={'Maria Silva\nJoão Santos\nAna Costa\n...'}
            />
            <div className="mt-1 text-xs text-slate-500">
              {nomesLimpos().length} nome(s) na lista
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Vigência início">
              <TextInput
                type="datetime-local"
                value={vigenciaInicio}
                onChange={(e) => setVigenciaInicio(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </Field>
            <Field label="Vigência fim" hint="Em branco = sem prazo">
              <TextInput
                type="datetime-local"
                value={vigenciaFim}
                onChange={(e) => setVigenciaFim(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </Field>
          </div>

          <Field label="Observação (aplicada a todos)">
            <TextArea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: aniversário da Ana"
            />
          </Field>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Liberando...' : `Liberar ${nomesLimpos().length || ''} acessos`}
            </Button>
            <Link to="/acessos">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
          <div className="text-sm">
            <span className="text-emerald-300">✓ {okCount} liberados</span>
            {erroCount > 0 && <span className="text-red-300 ml-3">✗ {erroCount} falhas</span>}
          </div>
          <ul className="space-y-1 max-h-80 overflow-y-auto text-sm">
            {resultado.map((r, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 ${
                  r.status === 'ok' ? 'text-slate-300' : 'text-red-300'
                }`}
              >
                <span>{r.status === 'ok' ? '✓' : '✗'}</span>
                <span className="flex-1">
                  {r.nome}
                  {r.motivo && <span className="block text-xs text-slate-500">{r.motivo}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/acessos')}>Ver lista</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setResultado(null)
                setLista('')
              }}
            >
              Novo evento
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

