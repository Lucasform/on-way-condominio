import { useEffect, useState } from 'react'
import { getPushStatus, enablePush, disablePush, pushSupported } from '../lib/push'
import Button from './ui/Button'
import { useConfirm } from './ui/ConfirmProvider'

export default function PushToggle() {
  const confirm = useConfirm()
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const s = await getPushStatus()
      setSupported(s.supported)
      setSubscribed(s.subscribed)
      setPermission(s.permission)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleEnable() {
    setWorking(true)
    setError(null)
    try {
      const ok = await enablePush()
      if (!ok) {
        setError('Permissão de notificação negada pelo navegador.')
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(false)
    }
  }

  async function handleDisable() {
    const ok = await confirm({
      message: 'Desativar notificações deste dispositivo?',
      tone: 'danger',
      confirmText: 'Desativar',
    })
    if (!ok) return
    setWorking(true)
    setError(null)
    try {
      await disablePush()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Verificando suporte a notificações...</div>
  }

  if (!supported || !pushSupported()) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-400">
        🔕 Notificações push não suportadas neste navegador.{' '}
        <span className="text-xs">No iPhone: instale o app como "Tela de Início" pelo Safari (iOS 16.4+).</span>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-100 mb-1">
            🔔 Notificações push
          </div>
          <p className="text-xs text-slate-400">
            {subscribed
              ? 'Ativas neste dispositivo. Você recebe alertas mesmo com o app fechado.'
              : permission === 'denied'
              ? 'Bloqueado nas configurações do navegador. Libere manualmente nas permissões do site.'
              : 'Receba alertas de multas, encomendas, mensagens e eventos mesmo com o app fechado.'}
          </p>
          {error && (
            <div className="mt-2 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="shrink-0">
          {subscribed ? (
            <Button variant="danger" onClick={handleDisable} disabled={working}>
              {working ? '...' : 'Desativar'}
            </Button>
          ) : permission === 'denied' ? (
            <Button variant="secondary" disabled>
              Bloqueado
            </Button>
          ) : (
            <Button onClick={handleEnable} disabled={working}>
              {working ? 'Pedindo...' : 'Ativar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
