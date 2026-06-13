import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { createAcesso, getMyUnidadeIds } from '../lib/acessos'
import { listUnidades } from '../lib/unidades'
import { isStaff } from '../lib/permissions'
import type { Unidade } from '../types/unidade'
import type {
  AcessoAutorizadoInput,
  DocumentoTipo,
  ModalidadeVigencia,
  Recorrencia,
  TipoAcesso,
} from '../types/acesso'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const TIPO_INFO: Record<TipoAcesso, { titulo: string; emoji: string; descricao: string }> = {
  visitante: {
    titulo: 'Visitante',
    emoji: '👤',
    descricao: 'Amigo, parente ou conhecido com vinda pontual.',
  },
  prestador: {
    titulo: 'Prestador',
    emoji: '🛠',
    descricao: 'Técnico, instalador, manutenção que vai entrar na unidade.',
  },
  entregador: {
    titulo: 'Entregador',
    emoji: '🛵',
    descricao: 'Delivery ou retirada agendada.',
  },
  familiar: {
    titulo: 'Familiar',
    emoji: '👨‍👩‍👧',
    descricao: 'Familiar que costuma vir, sem cadastro fixo.',
  },
  fixo: {
    titulo: 'Recorrente',
    emoji: '🔁',
    descricao: 'Diarista, cuidador, professor — entra regularmente.',
  },
}

const EMPTY: AcessoAutorizadoInput = {
  condominio_id: '',
  unidade_id: '',
  nome: '',
  documento_tipo: null,
  documento_numero: null,
  telefone: null,
  tipo: 'visitante',
  modalidade_vigencia: 'hoje',
  vigencia_inicio: '',
  vigencia_fim: null,
  recorrencia: null,
  uso_unico: false,
  placa_veiculo: null,
  acompanhantes_permitidos: 0,
  notificar_entrada: true,
  foto_url: null,
  observacao: null,
}

const MODALIDADE_LABEL: Record<ModalidadeVigencia, { titulo: string; emoji: string; desc: string }> = {
  hoje: {
    titulo: 'Só hoje',
    emoji: '📅',
    desc: 'Vale até a meia-noite de hoje.',
  },
  data: {
    titulo: 'Data específica',
    emoji: '🗓',
    desc: 'Um dia específico no futuro.',
  },
  periodo: {
    titulo: 'Período',
    emoji: '↔',
    desc: 'Intervalo entre duas datas.',
  },
  indefinido: {
    titulo: 'Sem prazo',
    emoji: '∞',
    desc: 'Vale até a unidade revogar.',
  },
  recorrente: {
    titulo: 'Recorrente',
    emoji: '🔁',
    desc: 'Repete em dias específicos da semana.',
  },
}

const DIAS_SEMANA = [
  { v: 'seg', l: 'Seg' },
  { v: 'ter', l: 'Ter' },
  { v: 'qua', l: 'Qua' },
  { v: 'qui', l: 'Qui' },
  { v: 'sex', l: 'Sex' },
  { v: 'sab', l: 'Sáb' },
  { v: 'dom', l: 'Dom' },
]

function endOfTodayISO(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function endOfDayISO(localValue: string): string {
  if (!localValue) return ''
  const d = new Date(localValue)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
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

export default function AcessoNovo() {
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const staff = isStaff(perfil?.role)

  const [form, setForm] = useState<AcessoAutorizadoInput>(EMPTY)
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve condominio_id e unidades disponiveis
  useEffect(() => {
    if (!user || !perfil?.condominio_id) return
    const condo = perfil.condominio_id
    setForm((f) => ({ ...f, condominio_id: condo }))

    if (staff) {
      // staff pode autorizar pra qualquer unidade
      listUnidades({ condominio_id: condo, ativo: true })
        .then(setUnidades)
        .catch(() => {})
    } else {
      // morador so as proprias unidades
      ;(async () => {
        const myIds = await getMyUnidadeIds(condo, user.id)
        const all = await listUnidades({ condominio_id: condo, ativo: true })
        const mine = all.filter((u) => myIds.includes(u.id))
        setUnidades(mine)
        if (mine.length === 1) {
          setForm((f) => ({ ...f, unidade_id: mine[0].id }))
        }
      })().catch(() => {})
    }
  }, [user, perfil, staff])

  function update<K extends keyof AcessoAutorizadoInput>(key: K, value: AcessoAutorizadoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const tipoInfo = useMemo(() => TIPO_INFO[form.tipo], [form.tipo])

  // Recorrencia: dias selecionados separados pra controle direto da UI
  const recDias = form.recorrencia?.dias_semana ?? []
  function toggleDiaRec(v: string) {
    const cur = new Set(form.recorrencia?.dias_semana ?? [])
    if (cur.has(v)) cur.delete(v)
    else cur.add(v)
    update('recorrencia', {
      ...(form.recorrencia ?? {}),
      dias_semana: Array.from(cur),
    } as Recorrencia)
  }
  function setRecHorario(k: 'horario_inicio' | 'horario_fim', v: string) {
    update('recorrencia', {
      ...(form.recorrencia ?? {}),
      [k]: v || undefined,
    } as Recorrencia)
  }

  function changeModalidade(m: ModalidadeVigencia) {
    // Limpa campos incompativeis com a modalidade escolhida
    update('modalidade_vigencia', m)
    if (m === 'hoje') {
      update('vigencia_inicio', '')
      update('vigencia_fim', null)
      update('recorrencia', null)
    } else if (m === 'data') {
      update('vigencia_fim', null)
      update('recorrencia', null)
    } else if (m === 'periodo') {
      update('recorrencia', null)
    } else if (m === 'indefinido') {
      update('vigencia_inicio', '')
      update('vigencia_fim', null)
      update('recorrencia', null)
    } else if (m === 'recorrente') {
      update('vigencia_fim', null)
      if (!form.recorrencia) update('recorrencia', { dias_semana: [] })
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.condominio_id) return setError('Condomínio não identificado.')
    if (!form.unidade_id) return setError('Selecione a unidade.')
    if (!form.nome.trim()) return setError('Informe o nome do autorizado.')
    if (form.modalidade_vigencia === 'recorrente' && !(form.recorrencia?.dias_semana?.length)) {
      return setError('Recorrência exige ao menos um dia da semana.')
    }
    setSubmitting(true)
    setError(null)
    try {
      let vigenciaInicio: string
      let vigenciaFim: string | null = null
      const agora = new Date().toISOString()
      switch (form.modalidade_vigencia) {
        case 'hoje':
          vigenciaInicio = agora
          vigenciaFim = endOfTodayISO()
          break
        case 'data':
          vigenciaInicio = form.vigencia_inicio
            ? fromLocalInput(form.vigencia_inicio)
            : agora
          vigenciaFim = form.vigencia_inicio ? endOfDayISO(form.vigencia_inicio) : endOfTodayISO()
          break
        case 'periodo':
          vigenciaInicio = form.vigencia_inicio
            ? fromLocalInput(form.vigencia_inicio)
            : agora
          vigenciaFim = form.vigencia_fim ? fromLocalInput(form.vigencia_fim) : null
          if (!vigenciaFim) return setError('Período exige data fim.')
          break
        case 'indefinido':
          vigenciaInicio = agora
          vigenciaFim = null
          break
        case 'recorrente':
          vigenciaInicio = form.vigencia_inicio
            ? fromLocalInput(form.vigencia_inicio)
            : agora
          vigenciaFim = form.vigencia_fim ? fromLocalInput(form.vigencia_fim) : null
          break
        default:
          vigenciaInicio = agora
      }

      const novo = await createAcesso(
        {
          ...form,
          vigencia_inicio: vigenciaInicio,
          vigencia_fim: vigenciaFim,
        },
        user.id,
      )
      navigate(`/acessos/${novo.id}`)
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Liberar acesso"
        actions={
          <Link to="/acessos">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <Field label="Tipo" required>
          <Select
            value={form.tipo}
            onChange={(e) => update('tipo', e.target.value as TipoAcesso)}
          >
            {(Object.keys(TIPO_INFO) as TipoAcesso[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_INFO[t].emoji} {TIPO_INFO[t].titulo}
              </option>
            ))}
          </Select>
          <span className="block mt-1 text-xs text-slate-500">{tipoInfo.descricao}</span>
        </Field>

        <Field label="Unidade" required>
          <Select
            value={form.unidade_id}
            onChange={(e) => update('unidade_id', e.target.value)}
            disabled={unidades.length === 0}
          >
            <option value="">— Selecione —</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nome do autorizado" required>
          <TextInput
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
            placeholder="Ex.: Maria Silva"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
          <Field label="Documento">
            <Select
              value={form.documento_tipo ?? ''}
              onChange={(e) => update('documento_tipo', (e.target.value || null) as DocumentoTipo | null)}
            >
              <option value="">—</option>
              <option value="cpf">CPF</option>
              <option value="rg">RG</option>
              <option value="cnh">CNH</option>
              <option value="passaporte">Passaporte</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          <Field label="Número">
            <TextInput
              value={form.documento_numero ?? ''}
              onChange={(e) => update('documento_numero', e.target.value || null)}
              placeholder="opcional"
            />
          </Field>
        </div>

        <Field label="Telefone">
          <TextInput
            value={form.telefone ?? ''}
            onChange={(e) => update('telefone', e.target.value || null)}
            placeholder="opcional"
          />
        </Field>

        <div>
          <span className="block text-sm font-medium text-slate-300 mb-2">
            Quando vale <span className="text-red-400 ml-1">*</span>
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(Object.keys(MODALIDADE_LABEL) as ModalidadeVigencia[]).map((m) => {
              const ativo = form.modalidade_vigencia === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => changeModalidade(m)}
                  className={`p-2 rounded-md border text-xs text-left transition ${
                    ativo
                      ? 'bg-brand-600/20 border-brand-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="text-base">{MODALIDADE_LABEL[m].emoji}</div>
                  <div className="font-medium">{MODALIDADE_LABEL[m].titulo}</div>
                </button>
              )
            })}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {MODALIDADE_LABEL[form.modalidade_vigencia ?? 'hoje'].desc}
          </div>
        </div>

        {form.modalidade_vigencia === 'data' && (
          <Field label="Dia" required>
            <TextInput
              type="datetime-local"
              value={form.vigencia_inicio ? toLocalInput(form.vigencia_inicio) : ''}
              onChange={(e) => update('vigencia_inicio', e.target.value)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            />
          </Field>
        )}

        {form.modalidade_vigencia === 'periodo' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Início" required>
              <TextInput
                type="datetime-local"
                value={form.vigencia_inicio ? toLocalInput(form.vigencia_inicio) : ''}
                onChange={(e) => update('vigencia_inicio', e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </Field>
            <Field label="Fim" required>
              <TextInput
                type="datetime-local"
                value={form.vigencia_fim ? toLocalInput(form.vigencia_fim) : ''}
                onChange={(e) => update('vigencia_fim', e.target.value || null)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </Field>
          </div>
        )}

        {form.modalidade_vigencia === 'recorrente' && (
          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3 space-y-3">
            <div>
              <span className="block text-xs text-slate-400 mb-2">Dias da semana *</span>
              <div className="flex flex-wrap gap-1">
                {DIAS_SEMANA.map((d) => (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDiaRec(d.v)}
                    className={`px-3 py-1 text-xs rounded border ${
                      recDias.includes(d.v)
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora início">
                <TextInput
                  type="time"
                  value={form.recorrencia?.horario_inicio ?? ''}
                  onChange={(e) => setRecHorario('horario_inicio', e.target.value)}
                />
              </Field>
              <Field label="Hora fim">
                <TextInput
                  type="time"
                  value={form.recorrencia?.horario_fim ?? ''}
                  onChange={(e) => setRecHorario('horario_fim', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Vigência até" hint="Em branco = sem prazo">
              <TextInput
                type="date"
                value={form.vigencia_fim ? toLocalInput(form.vigencia_fim).slice(0, 10) : ''}
                onChange={(e) => update('vigencia_fim', e.target.value ? new Date(e.target.value).toISOString() : null)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </Field>
          </div>
        )}

        <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3 space-y-3">
          <div className="text-sm font-medium text-slate-200">Configurações da entrada</div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.uso_unico ?? false}
              onChange={(e) => update('uso_unico', e.target.checked)}
            />
            <span>Uso único <span className="text-slate-500 text-xs">(expira após a primeira entrada)</span></span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.notificar_entrada ?? true}
              onChange={(e) => update('notificar_entrada', e.target.checked)}
            />
            <span>Notificar a unidade quando a portaria liberar</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Placa do veículo">
              <TextInput
                value={form.placa_veiculo ?? ''}
                onChange={(e) => update('placa_veiculo', e.target.value.toUpperCase() || null)}
                placeholder="opcional"
              />
            </Field>
            <Field label="Acompanhantes permitidos" hint="0 = só o autorizado">
              <TextInput
                type="number"
                min={0}
                max={20}
                value={form.acompanhantes_permitidos ?? 0}
                onChange={(e) => update('acompanhantes_permitidos', Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        </div>

        <Field label="Observação">
          <TextArea
            value={form.observacao ?? ''}
            onChange={(e) => update('observacao', e.target.value || null)}
            placeholder="Ex.: vai entregar um sofá pela garagem"
            rows={3}
          />
        </Field>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Liberar acesso'}
          </Button>
          <Link to="/acessos">
            <Button type="button" variant="ghost">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}

