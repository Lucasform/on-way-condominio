import { useEffect, useState, useCallback } from 'react'
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
      const [list, count] = await Promise.all([
        listMyNotifications({ limit: 20 }),
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

  // Carrega inicial
  useEffect(() => {
    reload()
  }, [reload])

  // Subscrição Realtime: qualquer INSERT/UPDATE em app_notifications do user atual
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`app_notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          reload()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, reload])

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
