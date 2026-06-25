import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthShell from '../components/AuthShell'
import { validatePassword, PASSWORD_HINT } from '../lib/passwordPolicy'

const inputCls =
  'w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 ' +
  'text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm'

const primaryBtn =
  'w-full py-2 rounded-md bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold text-sm transition disabled:opacity-50'

export default function SignupParceiro() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [codigo, setCodigo] = useState(params.get('code') ?? '')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!codigo.trim()) { setErro('Informe o código do convite.'); return }
    if (!nome.trim()) { setErro('Informe seu nome.'); return }
    if (!email.trim()) { setErro('Informe seu e-mail.'); return }

    const pwCheck = validatePassword(password)
    if (!pwCheck.ok) { setErro(pwCheck.errors.join(', ')); return }
    if (password !== confirmPassword) { setErro('As senhas não coincidem.'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('redeem-plataforma-invite', {
        body: { codigo: codigo.trim().toUpperCase(), email: email.trim(), password, nome: nome.trim() },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setSucesso(true)
    } catch (e: unknown) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (sucesso) {
    return (
      <AuthShell title="Conta criada!">
        <div className="text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <p className="text-slate-300 text-sm">
            Sua conta de parceiro foi criada com sucesso. Faça login para começar.
          </p>
          <button onClick={() => navigate('/login')} className={primaryBtn}>
            Ir para o login
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Cadastro de Parceiro">
      <p className="text-slate-400 text-sm text-center mb-6">
        Use o código enviado pelo administrador OnWay para criar sua conta.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Código do convite</label>
          <input
            type="text"
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            className={`${inputCls} font-mono tracking-widest uppercase`}
            autoCapitalize="characters"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Seu nome</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Senha</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className={inputCls} />
          <p className="text-xs text-slate-500 mt-1">{PASSWORD_HINT}</p>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Confirmar senha</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" className={inputCls} />
        </div>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}

        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? 'Criando conta...' : 'Criar conta de parceiro'}
        </button>
      </form>
    </AuthShell>
  )
}
