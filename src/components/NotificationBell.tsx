import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { useNotifications } from '../hooks/useNotifications'
import type { TipoNotificacao } from '../types/notification'

const ICON: Record<TipoNotificacao, string> = {
  ocorrencia: '📋',
  multa: '💰',
  encomenda: '📦',
  mural: '📣',
  evento: '📅',
  sistema: '⚙️',
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { items, unread, markAsRead, markAllAsRead } = useNotifications(user?.id ?? null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleClick(notifId: string, link: string | null) {
    await markAsRead(notifId)
    setOpen(false)
    if (link) navigate(link)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-slate-800/60 transition"
        aria-label="Notificações"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[28rem] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="text-sm font-semibold text-slate-100">Notificações</div>
            {unread > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Sem notificações.
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n.id, n.link)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition flex gap-3 ${
                        n.lida ? '' : 'bg-slate-800/20'
                      }`}
                    >
                      <span className="text-xl shrink-0">{ICON[n.tipo]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-medium ${n.lida ? 'text-slate-300' : 'text-slate-100'}`}>
                            {n.titulo}
                          </span>
                          {!n.lida && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </div>
                        {n.conteudo && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.conteudo}</p>
                        )}
                        <p className="text-[10px] text-slate-600 mt-1">
                          {new Date(n.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
