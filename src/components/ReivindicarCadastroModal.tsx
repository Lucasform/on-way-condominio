import { useState } from 'react'
import { claimPessoa } from '../lib/pessoas'

interface Props {
  onVinculado: () => void
}

export default function ReivindicarCadastroModal({ onVinculado }: Props) {
  const [open, setOpen] = useState(false)
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  function formatCpf(val: string) {
    const d = val.replace(/\D/g, '').slice(0, 11)
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  async function reivindicar() {
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) {
      setErro('CPF inválido. Informe os 11 dígitos.')
      return
    }
    setLoading(true)
    setErro(null)
    const r = await claimPessoa(digits)
    setLoading(false)
    if (!r.ok) {
      setErro(r.error ?? 'Não foi possível vincular.')
      return
    }
    setSucesso(`Cadastro de ${r.nome ?? 'morador'} vinculado com sucesso!`)
    setTimeout(() => {
      setOpen(false)
      setCpf('')
      setSucesso(null)
      onVinculado()
    }, 2000)
  }

  return (
    <>
      {/* Banner de aviso */}
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <span className="text-amber-400 text-lg shrink-0 mt-0.5">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-300">Seu cadastro de morador não está vinculado</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Se você já foi cadastrado pela administração, informe seu CPF para vincular automaticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(true); setErro(null); setSucesso(null) }}
          className="shrink-0 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-semibold transition"
        >
          Vincular cadastro
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">Vincular meu cadastro</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Informe o CPF cadastrado pela administração para vincular sua conta.
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {sucesso ? (
                <div className="flex items-center gap-2 text-emerald-300 text-sm">
                  <span className="text-lg">✓</span>
                  {sucesso}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">CPF</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => { setCpf(formatCpf(e.target.value)); setErro(null) }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      disabled={loading}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-600 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 font-mono"
                    />
                  </div>

                  {erro && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                      {erro}
                    </p>
                  )}
                </>
              )}
            </div>

            {!sucesso && (
              <div className="px-6 pb-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 text-sm transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void reivindicar()}
                  disabled={loading || cpf.replace(/\D/g, '').length !== 11}
                  className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition disabled:opacity-40"
                >
                  {loading ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
