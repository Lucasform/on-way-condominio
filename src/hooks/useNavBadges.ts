import { useEffect, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { countConversasNaoLidas } from '../lib/chat'
import { countWaUnread } from '../lib/whatsappInbox'

/**
 * Contadores de "pendências" por rota, pra badges na navegação (bottom nav e
 * launcher). Atualiza ao montar e a cada 30s. Falhas são silenciosas (badge é
 * acessório). Retorna um mapa rota → número (> 0).
 */
export function useNavBadges(): Record<string, number> {
  const { user, perfil } = useAuth()
  const [badges, setBadges] = useState<Record<string, number>>({})

  const condoId = perfil?.condominio_id ?? null
  const isStaffWa = !!perfil && ['administradora', 'sindico', 'subsindico'].includes(perfil.role)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user) { setBadges({}); return }
    let alive = true
    const load = async () => {
      const next: Record<string, number> = {}
      try {
        const chat = await countConversasNaoLidas(user.id)
        if (chat > 0) next['/chat'] = chat
      } catch { /* badge é acessório */ }
      if (condoId && isStaffWa) {
        try {
          const wa = await countWaUnread(condoId)
          if (wa > 0) next['/whatsapp'] = wa
        } catch { /* idem */ }
      }
      if (alive) setBadges(next)
    }
    load()
    const t = window.setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [user, condoId, isStaffWa])

  return badges
}
