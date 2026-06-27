import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * Exibe um banner fixo no topo quando o usuário perde a conexão.
 * Some automaticamente ao reconectar.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 text-amber-950 text-sm font-medium py-2 px-4 shadow-md"
    >
      <span className="text-base">⚠</span>
      Sem conexão com a internet. Verifique sua rede.
    </div>
  )
}
