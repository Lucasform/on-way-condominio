import { supabase } from './supabase'
import type { AppNotification } from '../types/notification'

export async function listMyNotifications(opts: { onlyUnread?: boolean; limit?: number } = {}): Promise<AppNotification[]> {
  let q = supabase
    .from('app_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 30)
  if (opts.onlyUnread) q = q.eq('lida', false)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from('app_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('lida', false)
  if (error) throw error
  return count ?? 0
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('app_notifications')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase
    .from('app_notifications')
    .update({ lida: true, lida_em: new Date().toISOString() })
    .eq('lida', false)
  if (error) throw error
}
