import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createEvento, getEvento, updateEvento, enviarLembreteEvento } from '../lib/eventos'
import { listCondominios } from '../lib/condominios'
import type { EventoInput, TipoEvento } from '../types/evento'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea, Select } from '../components/ui/Input'

const EMPTY: EventoInput = {
  condominio_id: '',
  titulo: '',
  descricao: null,
  data_inicio: '',
  data_fim: null,
  local: null,
  tipo: 'evento',
  publico: true,
}

export default function CalendarioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isNew = !id || id === 'novo'
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [form, setForm] = useState<EventoInput>(EMPTY)
  const [condos, setCondos] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingLembrete, setSendingLembrete] = useState(false)
  const [lembreteMsg, setLembreteMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios({ ativo: true }).then(setCondos).catch(() => {})
    } else if (perfil?.condominio_id && isNew) {
      setForm((f) => ({ ...f, condominio_id: perfil.condominio_id! }))
    }
  }, [isAdmin, perfil, isNew])

  useEffect(() => {
    if (isNew) return
    let mounted = true
    ;(async () => {
      try {
        const e = await getEvento(id!)
        if (!mounted) return
        if (!e) {
          setError('Evento não encontrado.')
        } else {
          setForm({
            condominio_id: e.condominio_id,
            titulo: e.titulo,
            descricao: e.descricao,
            data_inicio: toLocalInput(e.data_inicio),
            data_fim: e.data_fim ? toLocalInput(e.data_fim) : null,
            local: e.local,
            tipo: e.tipo,
            publico: e.publico,
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id, isNew])

  function update<K extends keyof EventoInput>(key: K, value: EventoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) return setError('Selecione o condomínio.')
    if (!form.titulo.trim() || !form.data_inicio) return setError('Título e data de início são obrigatórios.')

    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        // datetime-local vem sem timezone — assume horário local e converte pra ISO
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
      }
      if (isNew) await createEvento(payload)
      else await updateEvento(id!, payload)
      navigate('/calendario')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  return (
    <div className="px-8 py-10 max-w-2xl">
      <PageHeader
        title={isNew ? 'Novo evento' : 'Editar evento'}
        actions={
          <Link to="/calendario">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {isAdmin && (
          <Field label="Condomínio" required>
            <Select
              required
              value={form.condominio_id}
              onChange={(e) => update('condominio_id', e.target.value)}
            >
              <option value="">Selecione...</option>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Título" required>
          <TextInput
            required
            value={form.titulo}
            onChange={(e) => update('titulo', e.target.value)}
            placeholder="Ex: Assembleia ordinária"
          />
        </Field>

        <Field label="Tipo" required>
          <Select
            value={form.tipo}
            onChange={(e) => update('tipo', e.target.value as TipoEvento)}
          >
            <option value="assembleia">Assembleia</option>
            <option value="manutencao">Manutenção</option>
            <option value="evento">Evento</option>
            <option value="reuniao">Reunião</option>
            <option value="outro">Outro</option>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Início" required>
            <TextInput
              type="datetime-local"
              required
              value={form.data_inicio}
              onChange={(e) => update('data_inicio', e.target.value)}
            />
          </Field>
          <Field label="Fim (opcional)">
            <TextInput
              type="datetime-local"
              value={form.data_fim ?? ''}
              onChange={(e) => update('data_fim', e.target.value || null)}
            />
          </Field>
        </div>

        <Field label="Local">
          <TextInput
            value={form.local ?? ''}
            onChange={(e) => update('local', e.target.value)}
            placeholder="Ex: Salão de festas"
          />
        </Field>

        <Field label="Descrição">
          <TextArea
            rows={3}
            value={form.descricao ?? ''}
            onChange={(e) => update('descricao', e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.publico}
            onChange={(e) => update('publico', e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
          />
          Visível para os moradores (desmarque pra eventos só da staff)
        </label>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </Button>
          <Link to="/calendario">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>

      {/* Etapa 70: enviar lembrete por e-mail (só pra evento existente, público) */}
      {!isNew && form.publico && (
        <div className="mt-8 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5">
          <div className="text-sm font-medium text-sky-200 mb-1">📣 Lembrete por e-mail</div>
          <p className="text-xs text-slate-400 mb-3">
            Envia agora um e-mail pra todos os moradores com e-mail cadastrado lembrando deste evento.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={sendingLembrete}
            onClick={async () => {
              if (!id) return
              if (!window.confirm('Enviar lembrete por e-mail pra todos os moradores agora?')) return
              setSendingLembrete(true)
              setLembreteMsg(null)
              try {
                const r = await enviarLembreteEvento(id)
                setLembreteMsg(
                  r.enviados === 0
                    ? 'Nenhum morador com e-mail cadastrado.'
                    : `✓ Enviados ${r.enviados}. Falhas: ${r.falhas}.`,
                )
              } catch (e) {
                setLembreteMsg('Erro: ' + (e instanceof Error ? e.message : String(e)))
              } finally {
                setSendingLembrete(false)
              }
            }}
          >
            {sendingLembrete ? 'Enviando...' : '📧 Enviar lembrete agora'}
          </Button>
          {lembreteMsg && <div className="mt-2 text-xs text-slate-300">{lembreteMsg}</div>}
        </div>
      )}
    </div>
  )
}

// datetime-local input precisa de formato YYYY-MM-DDTHH:MM (sem timezone)
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
