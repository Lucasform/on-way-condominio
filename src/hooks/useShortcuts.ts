import { useState, useEffect } from 'react'

export interface Shortcut {
  id: string
  label: string
  icon: string
  to: string
}

type RoleCatalog = Record<string, Shortcut[]>

const CATALOG: RoleCatalog = {
  admin_onway: [
    { id: 'condominios',     label: 'Condomínios',     icon: '🏢', to: '/condominios' },
    { id: 'pessoas',         label: 'Pessoas',         icon: '👥', to: '/pessoas' },
    { id: 'relatorios',      label: 'Relatórios',      icon: '📈', to: '/relatorios' },
    { id: 'emails',          label: 'E-mails',         icon: '✉️', to: '/emails-log' },
    { id: 'auditoria',       label: 'Auditoria',       icon: '🔍', to: '/audit-log' },
  ],
  administradora: [
    { id: 'ocorrencia-nova', label: 'Nova ocorrência', icon: '📝', to: '/ocorrencias/novo' },
    { id: 'multa-nova',      label: 'Registrar multa', icon: '⚡', to: '/multas/nova' },
    { id: 'notif-nova',      label: 'Nova notificação',icon: '🔔', to: '/notificacoes/nova' },
    { id: 'chamados',        label: 'Ver chamados',    icon: '🔧', to: '/chamados' },
    { id: 'pessoas',         label: 'Pessoas',         icon: '👥', to: '/pessoas' },
    { id: 'mural-novo',      label: 'Publicar mural',  icon: '📌', to: '/mural/novo' },
  ],
  sindico: [
    { id: 'ocorrencia-nova', label: 'Nova ocorrência', icon: '📝', to: '/ocorrencias/novo' },
    { id: 'multa-nova',      label: 'Registrar multa', icon: '⚡', to: '/multas/nova' },
    { id: 'notif-nova',      label: 'Nova notificação',icon: '🔔', to: '/notificacoes/nova' },
    { id: 'chamados',        label: 'Ver chamados',    icon: '🔧', to: '/chamados' },
    { id: 'assembleia-nova', label: 'Convocar assembleia', icon: '🏛️', to: '/assembleias/novo' },
    { id: 'mural-novo',      label: 'Publicar mural',  icon: '📌', to: '/mural/novo' },
  ],
  subsindico: [
    { id: 'ocorrencia-nova', label: 'Nova ocorrência', icon: '📝', to: '/ocorrencias/novo' },
    { id: 'chamados',        label: 'Ver chamados',    icon: '🔧', to: '/chamados' },
    { id: 'notif-nova',      label: 'Nova notificação',icon: '🔔', to: '/notificacoes/nova' },
  ],
  portaria: [
    { id: 'encomenda-nova',  label: 'Nova encomenda',  icon: '📦', to: '/encomendas/novo?tipo=encomenda' },
    { id: 'ocorrencia-nova', label: 'Nova ocorrência', icon: '📝', to: '/ocorrencias/novo' },
    { id: 'chamado-novo',    label: 'Abrir chamado',   icon: '🔧', to: '/chamados/novo' },
    { id: 'encomendas',      label: 'Ver encomendas',  icon: '📬', to: '/encomendas' },
  ],
  ronda: [
    { id: 'ocorrencia-nova', label: 'Nova ocorrência', icon: '📝', to: '/ocorrencias/novo' },
    { id: 'chamado-novo',    label: 'Abrir chamado',   icon: '🔧', to: '/chamados/novo' },
  ],
  morador: [
    { id: 'chamado-novo',    label: 'Abrir chamado',   icon: '🔧', to: '/chamados/novo' },
    { id: 'multas',          label: 'Ver multas',      icon: '📋', to: '/multas' },
    { id: 'notificacoes',    label: 'Notificações',    icon: '🔔', to: '/notificacoes' },
    { id: 'chat',            label: 'Chat',            icon: '💬', to: '/chat' },
  ],
}

const DEFAULT_COUNT = 3

function storageKey(userId: string) { return `onway:shortcuts:${userId}` }

export function useShortcuts(role: string | undefined, userId: string | undefined) {
  const catalog = CATALOG[role ?? ''] ?? []
  const defaultIds = catalog.slice(0, DEFAULT_COUNT).map((s) => s.id)

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (!userId) return defaultIds
    try {
      const raw = localStorage.getItem(storageKey(userId))
      return raw ? (JSON.parse(raw) as string[]) : defaultIds
    } catch { return defaultIds }
  })

  useEffect(() => {
    if (!userId) return
    try { localStorage.setItem(storageKey(userId), JSON.stringify(selectedIds)) } catch { /* ignore */ }
  }, [selectedIds, userId])

  const active = catalog.filter((s) => selectedIds.includes(s.id))

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return { catalog, active, selectedIds, toggle }
}
