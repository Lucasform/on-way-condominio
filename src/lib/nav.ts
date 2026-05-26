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
  // ============================================================
  // Administrador OnWay — operador do SaaS, visão global
  // ============================================================
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

  // ============================================================
  // Administradora — empresa que administra o condomínio
  // ============================================================
  administradora: [
    ...COMMON_TOP,
    { to: '/dashboard', label: 'Acompanhamento Geral' },
    { to: '/painel', label: 'Painel de trabalho' },
    {
      label: 'Cadastros',
      children: [
        { to: '/unidades', label: 'Unidades' },
        { to: '/pessoas', label: 'Pessoas' },
        { to: '/veiculos', label: 'Veículos' },
        { to: '/pets', label: 'Pets' },
        { to: '/regimento', label: 'Regimento' },
      ],
    },
    {
      label: 'Operação',
      children: [
        { to: '/ocorrencias', label: 'Ocorrências' },
        { to: '/notificacoes', label: 'Notificações' },
        { to: '/multas', label: 'Multas' },
        { to: '/chamados', label: 'Chamados' },
        { to: '/encomendas', label: 'Serviços de Portaria' },
      ],
    },
    {
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
      ],
    },
    {
      label: 'Administração',
      children: [
        { to: '/votacoes', label: 'Votações' },
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/auditoria', label: 'Auditoria' },
      ],
    },
  ],

  // ============================================================
  // Síndico — mesma estrutura da administradora
  // ============================================================
  sindico: [
    ...COMMON_TOP,
    { to: '/dashboard', label: 'Acompanhamento Geral' },
    { to: '/painel', label: 'Painel de trabalho' },
    {
      label: 'Cadastros',
      children: [
        { to: '/unidades', label: 'Unidades' },
        { to: '/pessoas', label: 'Pessoas' },
        { to: '/veiculos', label: 'Veículos' },
        { to: '/pets', label: 'Pets' },
        { to: '/regimento', label: 'Regimento' },
      ],
    },
    {
      label: 'Operação',
      children: [
        { to: '/ocorrencias', label: 'Ocorrências' },
        { to: '/notificacoes', label: 'Notificações' },
        { to: '/multas', label: 'Multas' },
        { to: '/chamados', label: 'Chamados' },
        { to: '/encomendas', label: 'Serviços de Portaria' },
      ],
    },
    {
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
      ],
    },
    {
      label: 'Administração',
      children: [
        { to: '/votacoes', label: 'Votações' },
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/auditoria', label: 'Auditoria' },
      ],
    },
  ],

  // ============================================================
  // Portaria — função principal Encomendas + registros + comunicação
  // ============================================================
  portaria: [
    ...COMMON_TOP,
    { to: '/encomendas', label: 'Serviços de Portaria' },
    {
      label: 'Registros',
      children: [
        { to: '/ocorrencias', label: 'Ocorrências' },
        { to: '/chamados', label: 'Chamados' },
      ],
    },
    {
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
      ],
    },
  ],

  // ============================================================
  // Ronda — 3 itens, mantido flat (agrupar adiciona ruído)
  // ============================================================
  ronda: [
    ...COMMON_TOP,
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/chamados', label: 'Chamados' },
  ],

  // ============================================================
  // Morador — visão pessoal + condomínio
  // ============================================================
  morador: [
    ...COMMON_TOP,
    { to: '/meu-perfil', label: 'Meu perfil' },
    {
      label: 'Minhas pendências',
      children: [
        { to: '/multas', label: 'Minhas multas' },
        { to: '/encomendas', label: 'Minhas encomendas' },
        { to: '/notificacoes', label: 'Minhas notificações' },
      ],
    },
    {
      label: 'Registros',
      children: [
        { to: '/ocorrencias', label: 'Ocorrências' },
        { to: '/chamados', label: 'Chamados' },
      ],
    },
    {
      label: 'Condomínio',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
        { to: '/votacoes', label: 'Votações' },
      ],
    },
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
