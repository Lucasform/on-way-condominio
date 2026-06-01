import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import Button from './ui/Button'
import Pill from './ui/Pill'
import { Field, TextInput, Select } from './ui/Input'

interface Props {
  condominio_id: string
  condominio_nome: string
  onChange?: () => void
}

const ROLES = [
  { value: 'administradora', label: 'Administradora' },
  { value: 'sindico',        label: 'Síndico' },
  { value: 'subsindico',     label: 'Subsíndico' },
  { value: 'conselheiro',    label: 'Conselheiro' },
  { value: 'portaria',       label: 'Portaria' },
  { value: 'ronda',          label: 'Ronda' },
  { value: 'morador',        label: 'Morador' },
] as const

type RoleVal = typeof ROLES[number]['value']

/**
 * Admin OnWay vincula um user existente (por e-mail) a este condomínio.
 * Alternativa ao convite: usuário já cadastrado em outro condo recebe
 * acesso a este sem refazer signup. Cria linha em perfis_condominios.
 */
export default function VincularUserAoCondo({ condominio_id, condominio_nome, onChange }: Props) {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway'

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleVal>('sindico')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  if (!isAdmin) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    const target = email.trim().toLowerCase()
    if (!target) return setError('Informe o e-mail do usuário.')
    setBusy(true)
    try {
      // 1) Resolve o user pelo e-mail (RPC pública existente busca em auth.users)
      const { data: lookup, error: lookErr } = await supabase
        .rpc('user_id_by_email', { p_email: target })
      const uid = Array.isArray(lookup) ? lookup[0]?.id : (lookup as { id?: string } | null)?.id
      if (lookErr || !uid) {
        setError('Nenhum usuário com esse e-mail. Peça pra pessoa criar conta antes.')
        return
      }
      // 2) Já existe vínculo?
      const { data: existente } = await supabase
        .from('perfis_condominios')
        .select('perfil_id, ativo, role')
        .eq('perfil_id', uid)
        .eq('condominio_id', condominio_id)
        .maybeSingle()
      if (existente) {
        if (existente.ativo) {
          setError(`Já vinculado como ${existente.role}.`)
          return
        }
        // Reativa
        const { error: upErr } = await supabase
          .from('perfis_condominios')
          .update({ ativo: true, role })
          .eq('perfil_id', uid)
          .eq('condominio_id', condominio_id)
        if (upErr) throw upErr
        setOk(`Vínculo reativado como ${role}.`)
      } else {
        const { error: insErr } = await supabase
          .from('perfis_condominios')
          .insert({ perfil_id: uid, condominio_id, role, ativo: true })
        if (insErr) throw insErr
        setOk(`Vinculado a ${condominio_nome} como ${role}.`)
      }
      setEmail('')
      onChange?.()
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Erro ao vincular.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className="border border-slate-700 rounded-md p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold text-slate-200">
        🔗 Vincular usuário existente
      </legend>
      <p className="text-xs text-slate-400 -mt-2">
        Dá acesso a um usuário já cadastrado em outro condomínio. Alternativa ao convite quando a pessoa já tem conta no OnWay.
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
        <Field label="E-mail do usuário" required>
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex.: maria@email.com"
            required
          />
        </Field>
        <Field label="Cargo">
          <Select value={role} onChange={(e) => setRole(e.target.value as RoleVal)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Button type="submit" loading={busy}>+ Vincular</Button>
      </form>
      {error && <Pill tone="danger">{error}</Pill>}
      {ok && <Pill tone="success" dot>{ok}</Pill>}
    </fieldset>
  )
}
