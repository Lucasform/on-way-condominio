import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { listMyNotifications, countUnread, markAsRead, markAllAsRead } from '../lib/notifications'
import type { AppNotification } from '../types/notification'

export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([])
      setUnread(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Sininho mostra só as não-lidas: ao marcar como lida, some da lista.
      const [list, count] = await Promise.all([
        listMyNotifications({ onlyUnread: true, limit: 20 }),
        countUnread(),
      ])
      setItems(list)
      setUnread(count)
    } catch (e) {
      console.warn('[notifications] reload erro:', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Ref pra reload — evita re-subscrever o canal quando o callback muda
  const reloadRef = useRef(reload)
  useEffect(() => { reloadRef.current = reload }, [reload])

  // Carrega inicial
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])

  // Subscrição Realtime: qualquer INSERT/UPDATE em app_notifications do user atual.
  // Depende SÓ de userId; nome de canal único por mount evita conflito com canal
  // que ainda esteja sendo desmontado (React StrictMode dev, navegação rápida).
  useEffect(() => {
    if (!userId) return
    const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
    const channel = supabase
      .channel(`app_notifications:${userId}:${suffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => { reloadRef.current() },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const mark = useCallback(async (id: string) => {
    await markAsRead(id)
    await reload()
  }, [reload])

  const markAll = useCallback(async () => {
    await markAllAsRead()
    await reload()
  }, [reload])

  return { items, unread, loading, reload, markAsRead: mark, markAllAsRead: markAll }
}
