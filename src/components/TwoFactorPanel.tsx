import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmProvider'

type Factor = { id: string; friendly_name?: string; factor_type: string; status: 'verified' | 'unverified' }

export default function TwoFactorPanel() {
  const toast = useToast()
  const confirm = useConfirm()
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Enrollment state
  const [enrollment, setEnrollment] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const totp = (data?.totp ?? []) as Factor[]
      setFactors(totp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  async function iniciarEnroll() {
    setError(null)
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'OnWay TOTP' })
      if (error) throw error
      setEnrollment({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmarEnroll() {
    if (!enrollment) return
    setBusy(true)
    setError(null)
    try {
      const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: chal.id,
        code: code.trim(),
      })
      if (vErr) throw vErr
      setEnrollment(null)
      setCode('')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código incorreto.')
    } finally {
      setBusy(false)
    }
  }

  async function removerFator(id: string) {
    const ok = await confirm({
      title: 'Remover fator 2FA',
      message: 'Remover este fator? Você perderá a proteção 2FA.',
      tone: 'danger',
      confirmText: 'Remover',
    })
    if (!ok) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
      if (error) throw error
      await reload()
      toast.success('Fator removido.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  const ativos = factors.filter((f) => f.status === 'verified')

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Autenticação em 2 fatores (2FA)
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Adicione uma camada extra de segurança usando um app autenticador (Google Authenticator, Authy, 1Password).
      </p>

      {loading && <div className="mt-4 text-sm text-slate-500">Carregando...</div>}
      {error && (
        <div className="mt-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {!loading && ativos.length > 0 && (
        <div className="mt-4 space-y-2">
          {ativos.map((f) => (
            <div key={f.id} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-md px-3 py-2 text-sm">
              <span className="text-emerald-700 dark:text-emerald-300">
                ✓ 2FA ativo · {f.friendly_name ?? 'TOTP'}
              </span>
              <button
                onClick={() => removerFator(f.id)}
                disabled={busy}
                className="text-xs text-red-700 dark:text-red-300 hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && ativos.length === 0 && !enrollment && (
        <Button onClick={iniciarEnroll} disabled={busy} className="mt-4">
          🔐 Configurar 2FA
        </Button>
      )}

      {enrollment && (
        <div className="mt-4 p-5 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900/40 space-y-4">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
              1. Abra seu app autenticador e escaneie o QR code:
            </p>
            <img src={enrollment.qr} alt="QR Code 2FA" className="mx-auto w-48 h-48 bg-white p-2 rounded" />
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer">Não consegue escanear? Use código manual</summary>
              <code className="mt-2 block bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded font-mono break-all text-xs">{enrollment.secret}</code>
            </details>
          </div>
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              2. Digite o código de 6 dígitos que aparecer:
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-2xl font-mono tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={confirmarEnroll} disabled={busy || code.length !== 6}>
              Confirmar e ativar
            </Button>
            <button
              onClick={() => { setEnrollment(null); setCode(''); setError(null) }}
              disabled={busy}
              className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
