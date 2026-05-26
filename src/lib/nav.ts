import type { Role } from '../types/database'

export interface MenuLeaf {
  to: string
  label: string
}

export interface MenuGroup {
  label: string
  children: MenuLeaf[]
}

export type MenuItem = MenuLeaf | MenuGroup

export function isGroup(item: MenuItem): item is MenuGroup {
  return 'children' in item
}

const COMMON_TOP: MenuItem[] = [{ to: '/', label: 'Início' }]

const MENU_BY_ROLE: Record<Role, MenuItem[]> = {
  admin_onway: [
    ...COMMON_TOP,
    { to: '/dashboard', label: 'Acompanhamento Geral' },
    { to: '/painel', label: 'Painel de trabalho' },
    { to: '/condominios', label: 'Condomínios' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/notificacoes', label: 'Notificações' },
    { to: '/multas', label: 'Multas' },
    { to: '/chamados', label: 'Chamados' },
    { to: '/encomendas', label: 'Serviços de Portaria' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/mural', label: 'Mural informativo' },
    {
      label: 'Comunicação',
      children: [
        { to: '/chat', label: 'Chat interno' },
        { to: '/emails-log', label: 'E-mail' },
        { to: '/whatsapp-config', label: 'WhatsApp' },
      ],
    },
    {
      label: 'Administração',
      children: [
        { to: '/votacoes', label: 'Votações' },
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/auditoria', label: 'Auditorias' },
        { to: '/servicos', label: 'Serviços' },
      ],
    },
  ],
  administradora: [
    ...COMMON_TOP,
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/painel', label: 'Painel' },
    { to: '/unidades', label: 'Unidades' },
    { to: '/pessoas', label: 'Pessoas' },
    { to: '/veiculos', label: 'Veículos' },
    { to: '/pets', label: 'Pets' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/notificacoes', label: 'Notificações' },
    { to: '/multas', label: 'Multas' },
    { to: '/chamados', label: 'Chamados' },
    { to: '/encomendas', label: 'Encomendas' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/chat', label: 'Chat' },
    { to: '/votacoes', label: 'Votações' },
    { to: '/regimento', label: 'Regimento' },
    { to: '/relatorios', label: 'Relatórios' },
    { to: '/auditoria', label: 'Auditoria' },
  ],
  sindico: [
    ...COMMON_TOP,
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/painel', label: 'Painel' },
    { to: '/unidades', label: 'Unidades' },
    { to: '/pessoas', label: 'Pessoas' },
    { to: '/veiculos', label: 'Veículos' },
    { to: '/pets', label: 'Pets' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/notificacoes', label: 'Notificações' },
    { to: '/multas', label: 'Multas' },
    { to: '/chamados', label: 'Chamados' },
    { to: '/encomendas', label: 'Encomendas' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/chat', label: 'Chat' },
    { to: '/votacoes', label: 'Votações' },
    { to: '/regimento', label: 'Regimento' },
    { to: '/relatorios', label: 'Relatórios' },
    { to: '/auditoria', label: 'Auditoria' },
  ],
  portaria: [
    ...COMMON_TOP,
    { to: '/encomendas', label: 'Encomendas' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/chamados', label: 'Chamados' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/chat', label: 'Chat' },
  ],
  ronda: [
    ...COMMON_TOP,
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/chamados', label: 'Chamados' },
  ],
  morador: [
    ...COMMON_TOP,
    { to: '/meu-perfil', label: 'Meu perfil' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/notificacoes', label: 'Minhas notificações' },
    { to: '/multas', label: 'Minhas multas' },
    { to: '/encomendas', label: 'Minhas encomendas' },
    { to: '/chamados', label: 'Chamados' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/chat', label: 'Chat' },
    { to: '/votacoes', label: 'Votações' },
  ],
}

export function menuFor(role: Role): MenuItem[] {
  return MENU_BY_ROLE[role] ?? COMMON_TOP
}

export function roleLabel(role: Role): string {
  return {
    admin_onway: 'Administrador OnWay',
    administradora: 'Administradora',
    sindico: 'Síndico',
    portaria: 'Portaria',
    ronda: 'Ronda',
    morador: 'Morador',
  }[role]
}
