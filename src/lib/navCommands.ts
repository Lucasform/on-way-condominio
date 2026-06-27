export interface NavCommand {
  id: string
  label: string
  icon: string
  to: string
  roles: string[] // '*' = todos
}

export const NAV_COMMANDS: NavCommand[] = [
  { id: 'painel',           label: 'Painel',             icon: '📊', to: '/painel',              roles: ['*'] },
  { id: 'multas',           label: 'Multas',             icon: '📋', to: '/multas',              roles: ['*'] },
  { id: 'ocorrencias',      label: 'Ocorrências',        icon: '📝', to: '/ocorrencias',         roles: ['*'] },
  { id: 'chamados',         label: 'Chamados',           icon: '🔧', to: '/chamados',            roles: ['*'] },
  { id: 'notificacoes',     label: 'Notificações',       icon: '🔔', to: '/notificacoes',        roles: ['*'] },
  { id: 'chat',             label: 'Chat',               icon: '💬', to: '/chat',                roles: ['*'] },
  { id: 'encomendas',       label: 'Encomendas',         icon: '📦', to: '/encomendas',          roles: ['*'] },
  { id: 'pessoas',          label: 'Pessoas',            icon: '👥', to: '/pessoas',             roles: ['admin_onway', 'administradora', 'sindico', 'subsindico', 'portaria'] },
  { id: 'unidades',         label: 'Unidades',           icon: '🏠', to: '/unidades',            roles: ['admin_onway', 'administradora', 'sindico', 'subsindico'] },
  { id: 'veiculos',         label: 'Veículos',           icon: '🚗', to: '/veiculos',            roles: ['*'] },
  { id: 'pets',             label: 'Pets',               icon: '🐾', to: '/pets',                roles: ['*'] },
  { id: 'mural',            label: 'Mural',              icon: '📌', to: '/mural',               roles: ['*'] },
  { id: 'calendario',       label: 'Calendário',         icon: '📅', to: '/calendario',          roles: ['*'] },
  { id: 'votacoes',         label: 'Votações',           icon: '🗳️', to: '/votacoes',            roles: ['*'] },
  { id: 'assembleias',      label: 'Assembleias',        icon: '🏛️', to: '/assembleias',         roles: ['*'] },
  { id: 'emails',           label: 'E-mails',            icon: '✉️', to: '/emails-log',          roles: ['admin_onway', 'administradora', 'sindico'] },
  { id: 'templates',        label: 'Templates',          icon: '📄', to: '/templates',           roles: ['admin_onway', 'administradora', 'sindico'] },
  { id: 'regimento',        label: 'Regimento',          icon: '📜', to: '/regimento',           roles: ['*'] },
  { id: 'relatorios',       label: 'Relatórios',         icon: '📈', to: '/relatorios',          roles: ['*'] },
  { id: 'condominios',      label: 'Condomínios',        icon: '🏢', to: '/condominios',         roles: ['admin_onway'] },
  { id: 'meu-perfil',       label: 'Meu Perfil',         icon: '👤', to: '/meu-perfil',          roles: ['*'] },
  { id: 'auditoria',        label: 'Log de Auditoria',   icon: '🔍', to: '/audit-log',           roles: ['admin_onway', 'administradora', 'sindico'] },
]

export function filterCommands(commands: NavCommand[], role: string | undefined, query: string): NavCommand[] {
  return commands.filter((cmd) => {
    if (cmd.roles[0] !== '*' && !cmd.roles.includes(role ?? '')) return false
    if (!query) return true
    return cmd.label.toLowerCase().includes(query.toLowerCase())
  })
}
