import { supabase } from './supabase'
import type { AppNotification } from '../types/notification'

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function listMyNotifications(opts: { onlyUnread?: boolean; limit?: number } = {}): Promise<AppNotification[]> {
  const uid = await currentUserId()
  if (!uid) return []
  let q = supabase
    .from('app_notifications')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 30)
  if (opts.onlyUnread) q = q.eq('lida', false)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function countUnread(): Promise<number> {
  const uid = await currentUserId()
  if (!uid) return 0
  const { count, error } = await supabase
    .from('app_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('lida', false)
  if (error) throw error
  return count ?? 0
}

export async function markAsRead(id: string): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase
    .from('app_notifications')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', uid)
  if (error) throw error
}

export async function markAllAsRead(): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase
    .from('app_notifications')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('user_id', uid)
    .eq('lida', false)
  if (error) throw error
}
