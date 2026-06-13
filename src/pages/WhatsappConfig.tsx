import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import { getWhatsappConfig, whatsappInstance, sendWhatsApp } from '../lib/whatsapp'
import type { Condominio } from '../types/condominio'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'

type ConnState = 'loading' | 'idle' | 'qr' | 'connected'

function qrSrc(b64: string): string {
  return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`
}

export default function WhatsappConfig() {
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string>('')
  const [state, setState] = useState<ConnState>('loading')
  const [qr, setQr] = useState<string | null>(null)
  const [pairing, setPairing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [testNumero, setTestNumero] = useState('')
  const [testando, setTestando] = useState(false)

  const pollRef = useRef<number | null>(null)
  const qrAgeRef = useRef(0)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Carrega condomínios (admin) ou usa o próprio escopo
  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => {
          setCondos(cs)
          if (cs.length && !scopeId) setScopeId(cs[0].id)
          else if (!cs.length) setState('idle')
        })
        .catch(() => setState('idle'))
    } else if (perfil?.condominio_id) {
      setScopeId(perfil.condominio_id)
    } else {
      setState('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, perfil])

  // Ao trocar de condomínio: consulta o status atual
  useEffect(() => {
    if (!scopeId) return
    stopPolling()
    setQr(null)
    setPairing(null)
    setState('loading')
    ;(async () => {
      try {
        await getWhatsappConfig(scopeId) // garante leitura/RLS
        const r = await whatsappInstance(scopeId, 'status')
        setState(r.conectado ? 'connected' : 'idle')
      } catch {
        setState('idle')
      }
    })()
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId])

  async function handleConnect() {
    if (!scopeId) return
    setBusy(true)
    try {
      const r = await whatsappInstance(scopeId, 'connect')
      if (r.error) {
        toast.error('Erro', r.error)
        return
      }
      if (r.status === 'open' || r.conectado) {
        setState('connected')
        toast.success('Conectado', 'WhatsApp já está conectado.')
        return
      }
      setQr(r.qr_base64 ?? null)
      setPairing(r.pairing_code ?? null)
      setState('qr')
      qrAgeRef.current = 0
      startPolling()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  function startPolling() {
    stopPolling()
    pollRef.current = window.setInterval(async () => {
      qrAgeRef.current += 3
      try {
        const r = await whatsappInstance(scopeId, 'status')
        if (r.conectado) {
          stopPolling()
          setQr(null)
          setPairing(null)
          setState('connected')
          toast.success('Conectado!', 'WhatsApp do condomínio espelhado com sucesso.')
          return
        }
        // QR do Evolution expira rápido; renova a cada ~30s
        if (qrAgeRef.current >= 30) {
          qrAgeRef.current = 0
          const c = await whatsappInstance(scopeId, 'connect')
          if (c.qr_base64) setQr(c.qr_base64)
          if (c.pairing_code) setPairing(c.pairing_code)
        }
      } catch {
        /* silencioso — segue tentando */
      }
    }, 3000)
  }

  async function handleDisconnect() {
    const ok = await confirm({
      title: 'Desconectar WhatsApp?',
      message: 'O número será desvinculado do app. Você pode reconectar escaneando o QR de novo.',
      tone: 'danger',
      confirmText: 'Desconectar',
    })
    if (!ok) return
    setBusy(true)
    try {
      await whatsappInstance(scopeId, 'logout')
      stopPolling()
      setState('idle')
      toast.success('Desconectado', 'WhatsApp desvinculado.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setBusy(false)
    }
  }

  async function handleTest() {
    if (!scopeId || !testNumero) return
    setTestando(true)
    try {
      const r = await sendWhatsApp({
        condominio_id: scopeId,
        telefone: testNumero,
        texto: '🧪 Mensagem de teste do OnWay Condomínio. Se chegou, o WhatsApp está funcionando!',
      })
      if (r.ok) toast.success('Enviado', 'Veja se chegou no número.')
      else if (r.skipped) toast.error('Inativo', 'O canal não está ativo/conectado.')
      else toast.error('Falha', 'Não foi possível enviar.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setTestando(false)
    }
  }

  useEffect(() => stopPolling, [])

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="WhatsApp · Conexão"
        subtitle="Conecte o WhatsApp do condomínio escaneando o QR. As mensagens dos moradores chegam no app e as automações saem por aqui."
        actions={<Link to="/whatsapp"><Button variant="ghost">← Conversas</Button></Link>}
      />

      <p className="mb-5 text-[11px] text-slate-500">
        Conexão via API não-oficial do WhatsApp Web. Evite envio em massa para reduzir risco de bloqueio do número.
      </p>

      {isAdmin && condos.length > 0 && (
        <div className="mb-5 max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
          <select
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm text-slate-100"
          >
            {condos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      )}

      {state === 'loading' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
          Verificando conexão…
        </div>
      )}

      {state === 'idle' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center">
          <div className="text-4xl mb-3">📱</div>
          <p className="text-sm text-slate-300 mb-1">WhatsApp ainda não conectado</p>
          <p className="text-xs text-slate-500 mb-5">
            Clique abaixo pra gerar o QR e conectar o WhatsApp da empresa.
          </p>
          <Button onClick={handleConnect} disabled={busy}>
            {busy ? 'Gerando QR…' : 'Conectar WhatsApp'}
          </Button>
        </div>
      )}

      {state === 'qr' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center">
          <p className="text-sm text-slate-200 mb-1 font-medium">Escaneie com o WhatsApp da empresa</p>
          <p className="text-xs text-slate-500 mb-4">
            No celular: <strong>Configurações → Aparelhos conectados → Conectar aparelho</strong> e aponte para o QR.
          </p>
          {qr ? (
            <img
              src={qrSrc(qr)}
              alt="QR Code WhatsApp"
              className="mx-auto rounded-lg bg-white p-2 w-56 h-56 object-contain"
            />
          ) : (
            <div className="mx-auto w-56 h-56 rounded-lg bg-slate-800/60 animate-pulse" />
          )}
          {pairing && (
            <p className="mt-4 text-xs text-slate-400">
              Ou use o código de pareamento:{' '}
              <span className="font-mono text-base text-emerald-300 tracking-widest">{pairing}</span>
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Aguardando leitura… o QR renova sozinho.
          </p>
          <button onClick={handleDisconnect} className="mt-4 text-xs text-slate-500 hover:text-slate-300">
            Cancelar
          </button>
        </div>
      )}

      {state === 'connected' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm font-medium text-emerald-200">WhatsApp conectado</p>
            <p className="text-xs text-slate-400 mt-1">
              As mensagens dos moradores chegam no app e as automações saem por este número.
            </p>
            <Button variant="danger" onClick={handleDisconnect} disabled={busy} className="mt-4">
              Desconectar
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
            <div className="text-sm font-medium text-slate-200 mb-1">🧪 Testar envio</div>
            <p className="text-xs text-slate-500 mb-3">Manda uma mensagem teste pra um número.</p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={testNumero}
                onChange={(e) => setTestNumero(e.target.value)}
                placeholder="5511999999999"
                className="flex-1 px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100"
              />
              <Button onClick={handleTest} disabled={testando || !testNumero}>
                {testando ? '...' : 'Enviar teste'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

