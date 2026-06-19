import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { validatePassword, PASSWORD_HINT } from '../lib/passwordPolicy'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-setup`

const NUM_UNIDADES = [
  { value: 'ate_30', label: 'Até 30 unidades' },
  { value: '31_100', label: '31 a 100 unidades' },
  { value: '101_300', label: '101 a 300 unidades' },
  { value: 'mais_300', label: 'Mais de 300 unidades' },
]

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 ' +
  'text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none ' +
  'focus:ring-1 focus:ring-brand-500 text-sm transition'

const selectCls = inputCls

type Step = 1 | 2 | 3

export default function Comecar() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nomeCondo, setNomeCondo] = useState('')
  const [numUnidades, setNumUnidades] = useState('ate_30')
  const [cep, setCep] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [loadingCep, setLoadingCep] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscarCep(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setCidade(data.localidade ?? '')
        setEstado(data.uf ?? '')
      }
    } catch {}
    setLoadingCep(false)
  }

  function handleStep1(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const v = validatePassword(password)
    if (!v.ok) { setError('Senha fraca: ' + v.errors.join(', ') + '.'); return }
    setStep(2)
  }

  async function handleStep2(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nomeCondo.trim()) { setError('Informe o nome do condomínio.'); return }
    setSaving(true)
    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          nome,
          email,
          password,
          nome_condominio: nomeCondo,
          num_unidades: numUnidades,
          cep: cep || null,
          cidade: cidade || null,
          estado: estado || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Erro ao criar conta.')
        return
      }
      await supabase.auth.setSession(json.session)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar conta.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Tudo pronto!</h1>
          <p className="text-slate-400 mb-8">
            Seu condomínio <span className="text-slate-200 font-semibold">{nomeCondo}</span> está criado
            com <span className="text-brand-400 font-semibold">10 dias de acesso completo</span> sem custo.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition mb-3"
          >
            Começar a configurar →
          </button>
          <p className="text-xs text-slate-600">
            Após o trial, escolha o plano que melhor se encaixa no seu condomínio.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 flex items-center gap-3">
        <Link to="/landing" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold text-slate-100 text-sm">OnWay <span className="text-brand-400">Condomínio</span></span>
        </Link>
      </header>

      {/* Progress */}
      <div className="px-6 mb-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-2">
            {([1, 2] as Step[]).map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                  step > s ? 'bg-emerald-500 text-white' : step === s ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                <div className={`h-0.5 flex-1 rounded ${s < 2 ? (step > s ? 'bg-emerald-500' : 'bg-slate-800') : 'hidden'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>Sua conta</span>
            <span>Seu condomínio</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-12">
        <div className="max-w-md mx-auto">

          {/* Passo 1 — Conta */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-100 mb-1">Crie sua conta</h2>
                <p className="text-sm text-slate-500">Síndico ou membro da administração do condomínio.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-300 mb-1.5">Nome completo</span>
                  <input
                    type="text" required autoFocus value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className={inputCls}
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</span>
                  <input
                    type="email" required autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={inputCls}
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-slate-300 mb-1.5">Senha</span>
                  <input
                    type="password" required minLength={8} autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                  />
                  <span className="text-xs text-slate-500 mt-1 block">{PASSWORD_HINT}</span>
                </label>
              </div>

              {error && <ErrorBox msg={error} />}

              <button type="submit" className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition">
                Continuar →
              </button>

              <p className="text-xs text-center text-slate-500">
                Já tem conta?{' '}
                <Link to="/entrar" className="text-brand-400 hover:underline">Entrar</Link>
              </p>
            </form>
          )}

          {/* Passo 2 — Condomínio */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-100 mb-1">Seu condomínio</h2>
                <p className="text-sm text-slate-500">Você pode editar tudo isso depois no painel.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-300 mb-1.5">Nome do condomínio</span>
                  <input
                    type="text" required autoFocus value={nomeCondo}
                    onChange={(e) => setNomeCondo(e.target.value)}
                    placeholder="Ex: Residencial Jardim das Flores"
                    className={inputCls}
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-slate-300 mb-1.5">Número de unidades</span>
                  <select value={numUnidades} onChange={(e) => setNumUnidades(e.target.value)} className={selectCls}>
                    {NUM_UNIDADES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <label className="block col-span-1">
                    <span className="block text-sm font-medium text-slate-300 mb-1.5">CEP</span>
                    <input
                      type="text" value={cep}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                        setCep(v)
                        buscarCep(v)
                      }}
                      placeholder="00000000"
                      className={inputCls}
                    />
                  </label>
                  <label className="block col-span-1">
                    <span className="block text-sm font-medium text-slate-300 mb-1.5">
                      Cidade {loadingCep && <span className="text-slate-500 text-xs">buscando…</span>}
                    </span>
                    <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="São Paulo" className={inputCls} />
                  </label>
                  <label className="block col-span-1">
                    <span className="block text-sm font-medium text-slate-300 mb-1.5">UF</span>
                    <input type="text" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} placeholder="SP" className={inputCls} />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 flex items-start gap-3">
                <span className="text-lg shrink-0">🎁</span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">10 dias com tudo incluso, grátis</p>
                  <p className="text-xs text-slate-400 mt-0.5">Sem cartão de crédito. Sem compromisso. Cancele quando quiser.</p>
                </div>
              </div>

              {error && <ErrorBox msg={error} />}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition"
                >
                  ← Voltar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition disabled:opacity-60"
                >
                  {saving ? 'Criando seu condomínio…' : 'Criar e começar →'}
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-600">
                Ao criar sua conta você concorda com os{' '}
                <Link to="/termos" target="_blank" className="text-slate-500 hover:text-slate-400 underline">termos de uso</Link>
                {' '}e a{' '}
                <Link to="/privacidade" target="_blank" className="text-slate-500 hover:text-slate-400 underline">política de privacidade</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
      {msg}
    </div>
  )
}
