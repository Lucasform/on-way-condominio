import { useEffect, useState } from 'react'
import {
  listConvites,
  createConvite,
  deleteConvite,
  revogarConvite,
  renovarConvite,
  type Convite,
  type ConviteRole,
} from '../lib/convites'
import Button from './ui/Button'
import DeleteButton from './ui/DeleteButton'
import { Field, TextInput, Select } from './ui/Input'

interface Props {
  condominio_id: string
}

const ROLES: { value: ConviteRole; label: string }[] = [
  { value: 'morador', label: 'Morador' },
  { value: 'sindico', label: 'Síndico' },
  { value: 'subsindico', label: 'Subsíndico' },
  { value: 'conselheiro', label: 'Conselheiro' },
  { value: 'portaria', label: 'Portaria' },
  { value: 'ronda', label: 'Ronda' },
]

export default function ConvitesPanel({ condominio_id }: Props) {
  const [convites, setConvites] = useState<Convite[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [codigo, setCodigo] = useState('')
  const [role, setRole] = useState<ConviteRole>('morador')
  const [usosMax, setUsosMax] = useState(1)
  const [diasValidade, setDiasValidade] = useState(30)

  async function reload() {
    setLoading(true)
    try {
      const data = await listConvites(condominio_id)
      setConvites(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao listar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio_id])

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      await createConvite({
        condominio_id,
        codigo: codigo.trim() || undefined,
        role,
        usos_max: usosMax,
        dias_validade: diasValidade,
      })
      setCodigo('')
      setRole('morador')
      setUsosMax(1)
      setDiasValidade(30)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevogar(c: Convite) {
    if (!window.confirm(`Revogar código "${c.codigo}"? Não dará mais pra usar.`)) return
    try {
      await revogarConvite(c.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function handleApagar(c: Convite) {
    if (!window.confirm(`Apagar código "${c.codigo}" DEFINITIVAMENTE? Esta ação não pode ser desfeita.`)) return
    try {
      await deleteConvite(c.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao apagar.')
    }
  }

  async function handleRenovar(c: Convite) {
    if (!window.confirm(`Renovar "${c.codigo}" por +30 dias?\nUsos zeram e código fica reativado.`)) return
    try {
      await renovarConvite(c.id, 30)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  function statusDe(c: Convite): { label: string; cls: string } {
    if (c.revogado) return { label: 'Revogado', cls: 'bg-slate-700/40 text-slate-400' }
    if (new Date(c.expira_em) < new Date())
      return { label: 'Expirado', cls: 'bg-red-500/10 text-red-300 border border-red-500/30' }
    if (c.usos >= c.usos_max)
      return { label: 'Esgotado', cls: 'bg-amber-500/10 text-amber-300 border border-amber-500/30' }
    return { label: 'Ativo', cls: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' }
  }

  return (
    <fieldset className="border border-slate-200 dark:border-slate-700 rounded-md p-4 space-y-4">
      <legend className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Códigos de convite
      </legend>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
        Gere um código pra liberar criação de contas pelo formulário público de signup.
      </p>

      <div className="grid grid-cols-[1fr_140px_100px_100px_auto] gap-3 items-end">
        <Field label="Código">
          <TextInput
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="EX: FLAMBOYANT2026"
          />
        </Field>
        <Field label="Tipo de conta">
          <Select value={role} onChange={(e) => setRole(e.target.value as ConviteRole)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Usos máx.">
          <TextInput
            type="number"
            min={1}
            value={usosMax}
            onChange={(e) => setUsosMax(Math.max(1, parseInt(e.target.value || '1')))}
          />
        </Field>
        <Field label="Validade (dias)">
          <TextInput
            type="number"
            min={1}
            value={diasValidade}
            onChange={(e) => setDiasValidade(Math.max(1, parseInt(e.target.value || '30')))}
          />
        </Field>
        <Button type="button" onClick={handleCreate} disabled={creating}>
          {creating ? '...' : '+ Gerar'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="text-left py-2">Código</th>
              <th className="text-left py-2">Tipo</th>
              <th className="text-left py-2">Usos</th>
              <th className="text-left py-2">Validade</th>
              <th className="text-left py-2">Status</th>
              <th className="text-right py-2">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading && (
              <tr><td colSpan={6} className="py-4 text-center text-slate-500">Carregando...</td></tr>
            )}
            {!loading && convites.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-slate-500">Nenhum código ainda.</td></tr>
            )}
            {convites.map((c) => {
              const st = statusDe(c)
              return (
                <tr key={c.id}>
                  <td className="py-2 font-mono text-brand-700 dark:text-brand-400">{c.codigo}</td>
                  <td className="py-2 capitalize">{c.role}</td>
                  <td className="py-2">{c.usos}/{c.usos_max}</td>
                  <td className="py-2 text-xs">{formatDate(c.expira_em)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button type="button" variant="ghost" onClick={() => copiar(c.codigo)} title="Copiar código">
                        Copiar
                      </Button>
                      {(c.revogado || new Date(c.expira_em) < new Date() || c.usos >= c.usos_max) && (
                        <Button type="button" variant="secondary" onClick={() => handleRenovar(c)} title="Renovar +30 dias">
                          Renovar
                        </Button>
                      )}
                      {!c.revogado && (
                        <Button type="button" variant="ghost" onClick={() => handleRevogar(c)} title="Revogar (bloqueia mas mantém histórico)">
                          Revogar
                        </Button>
                      )}
                      <DeleteButton label="" onClick={() => handleApagar(c)} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </fieldset>
  )
}

function copiar(codigo: string) {
  navigator.clipboard?.writeText(codigo)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}
