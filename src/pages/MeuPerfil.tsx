import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'

interface Pessoa {
  id: string
  condominio_id: string
  unidade_id: string | null
  user_id: string | null
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  foto_url: string | null
  tipo_vinculo: string
  relacao_unidade: string | null
}

type Status = 'loading' | 'no-record' | 'editing' | 'saving' | 'saved' | 'error'

export default function MeuPerfil() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    foto_url: '',
  })

  useEffect(() => {
    if (!user) return
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from('pessoas')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!mounted) return
      if (error) {
        setError(error.message)
        setStatus('error')
        return
      }
      if (!data) {
        setStatus('no-record')
        return
      }
      const p = data as Pessoa
      setPessoa(p)
      setForm({
        nome: p.nome ?? '',
        email: p.email ?? '',
        telefone: p.telefone ?? '',
        data_nascimento: p.data_nascimento ?? '',
        foto_url: p.foto_url ?? '',
      })
      setStatus('editing')
    })()
    return () => {
      mounted = false
    }
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pessoa) return
    setStatus('saving')
    setError(null)
    const { error } = await supabase
      .from('pessoas')
      .update({
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.replace(/\D/g, '') || null,
        data_nascimento: form.data_nascimento || null,
        foto_url: form.foto_url.trim() || null,
      })
      .eq('id', pessoa.id)
    if (error) {
      setError(error.message)
      setStatus('error')
      return
    }
    setStatus('saved')
    setTimeout(() => setStatus('editing'), 2000)
  }

  if (status === 'loading') {
    return (
      <div className="px-8 py-10 text-slate-400">Carregando seu perfil...</div>
    )
  }

  if (status === 'no-record') {
    return (
      <div className="px-8 py-10">
        <h1 className="text-2xl font-semibold text-slate-100">Meu perfil</h1>
        <div className="mt-6 max-w-lg rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="font-medium text-amber-300">Cadastro não encontrado</div>
          <p className="mt-2 text-sm text-slate-300">
            Seu usuário ainda não está vinculado a um cadastro de pessoa no
            condomínio. Procure a administradora ou o síndico para fazer essa
            vinculação.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-10 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100">Meu perfil</h1>
      <p className="mt-1 text-sm text-slate-400">
        Mantenha seus dados atualizados.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Nome">
          <input
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field label="Telefone">
          <input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            placeholder="11999999999"
            className={inputCls}
          />
        </Field>

        <Field label="Data de nascimento">
          <input
            type="date"
            value={form.data_nascimento}
            onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field label="Foto (URL)">
          <input
            value={form.foto_url}
            onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {status === 'saved' && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
            Dados salvos.
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'saving'}
          className="px-5 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition disabled:opacity-50"
        >
          {status === 'saving' ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      {pessoa && (
        <div className="mt-10 pt-5 border-t border-slate-800 text-xs text-slate-500 space-y-1">
          <div>
            <span className="text-slate-600">Condomínio:</span>{' '}
            <span className="font-mono">{pessoa.condominio_id.slice(0, 8)}…</span>
          </div>
          {pessoa.unidade_id && (
            <div>
              <span className="text-slate-600">Unidade:</span>{' '}
              <span className="font-mono">{pessoa.unidade_id.slice(0, 8)}…</span>
            </div>
          )}
          <div>
            <span className="text-slate-600">Vínculo:</span> {pessoa.tipo_vinculo}
            {pessoa.relacao_unidade && ` · ${pessoa.relacao_unidade}`}
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm text-slate-100'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  )
}
