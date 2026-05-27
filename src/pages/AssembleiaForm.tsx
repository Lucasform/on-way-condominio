import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createAssembleia,
  getAssembleia,
  updateAssembleia,
  uploadAta,
} from '../lib/assembleias'
import { listCondominios } from '../lib/condominios'
import type { AssembleiaInput, StatusAssembleia, TipoAssembleia } from '../types/assembleia'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, Select } from '../components/ui/Input'

export default function AssembleiaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil, user } = useAuth()
  const isNew = !id || id === 'nova'
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [form, setForm] = useState<AssembleiaInput>({
    condominio_id: perfil?.condominio_id ?? '',
    titulo: '',
    tipo: 'ordinaria',
    data_assembleia: '',
    local: '',
    status: 'planejada',
    pauta: '',
    observacoes: '',
  })
  const [ataFile, setAtaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => {
          setCondos(cs)
          if (!form.condominio_id && cs.length) {
            setForm((f) => ({ ...f, condominio_id: cs[0].id }))
          }
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  useEffect(() => {
    if (isNew || !id) return
    getAssembleia(id)
      .then((a) => {
        if (!a) {
          setError('Assembleia não encontrada.')
          return
        }
        setForm({
          condominio_id: a.condominio_id,
          titulo: a.titulo,
          tipo: a.tipo,
          data_assembleia: a.data_assembleia.slice(0, 16), // ISO -> input datetime-local
          local: a.local,
          status: a.status,
          pauta: a.pauta,
          observacoes: a.observacoes,
        })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) { setError('Selecione o condomínio.'); return }
    if (!form.titulo.trim()) { setError('Informe o título.'); return }
    if (!form.data_assembleia) { setError('Informe a data e hora.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload: AssembleiaInput = {
        ...form,
        local: form.local?.trim() || null,
        pauta: form.pauta?.trim() || null,
        observacoes: form.observacoes?.trim() || null,
        data_assembleia: new Date(form.data_assembleia).toISOString(),
      }
      const saved = isNew
        ? await createAssembleia(payload, user?.id)
        : await updateAssembleia(id!, payload)

      if (ataFile) {
        const path = await uploadAta(ataFile, saved.condominio_id, saved.id)
        // ata_url guarda o path do bucket privado (signed URL gerada na hora de baixar)
        const { supabase } = await import('../lib/supabase')
        await supabase.from('assembleias').update({ ata_url: path }).eq('id', saved.id)
      }

      navigate(`/assembleias/${saved.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <PageHeader
        title={isNew ? 'Nova assembleia' : 'Editar assembleia'}
        actions={<Link to="/assembleias"><Button variant="ghost">← Voltar</Button></Link>}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {isAdmin && condos.length > 0 && (
          <Field label="Condomínio" required>
            <Select
              required
              value={form.condominio_id}
              onChange={(e) => setForm({ ...form, condominio_id: e.target.value })}
              disabled={!isNew}
            >
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
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex: AGO 2026 — Prestação de contas"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo" required>
            <Select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoAssembleia })}
            >
              <option value="ordinaria">Ordinária (AGO)</option>
              <option value="extraordinaria">Extraordinária (AGE)</option>
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StatusAssembleia })}
            >
              <option value="planejada">Planejada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
            </Select>
          </Field>
        </div>

        <Field label="Data e hora" required>
          <TextInput
            type="datetime-local"
            required
            value={form.data_assembleia}
            onChange={(e) => setForm({ ...form, data_assembleia: e.target.value })}
            onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </Field>

        <Field label="Local">
          <TextInput
            value={form.local ?? ''}
            onChange={(e) => setForm({ ...form, local: e.target.value })}
            placeholder="Ex: Salão de festas, virtual via Zoom..."
          />
        </Field>

        <Field label="Pauta">
          <textarea
            value={form.pauta ?? ''}
            onChange={(e) => setForm({ ...form, pauta: e.target.value })}
            rows={5}
            placeholder="Itens da pauta, um por linha"
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
          />
        </Field>

        <Field label="Observações">
          <textarea
            value={form.observacoes ?? ''}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
          />
        </Field>

        <Field label="Ata (PDF)">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setAtaFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-300"
          />
          <div className="text-xs text-slate-500 mt-1">
            Você pode anexar a ata agora ou depois pela tela de detalhe.
          </div>
        </Field>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : (isNew ? 'Criar assembleia' : 'Salvar alterações')}
          </Button>
          <Link to="/assembleias">
            <Button type="button" variant="secondary">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
