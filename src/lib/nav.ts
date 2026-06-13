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
    {
      label: 'Visão geral',
      children: [
        { to: '/dashboard', label: 'Acompanhamento Geral' },
        { to: '/painel', label: 'Painel de trabalho' },
      ],
    },
    {
      label: 'Gestão',
      children: [
        { to: '/condominios', label: 'Condomínios' },
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
        { to: '/acessos', label: 'Acessos autorizados' },
        { to: '/servicos', label: 'Prestação de Serviços' },
      ],
    },
    {
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
        { to: '/comunicados', label: 'Comunicados' },
        { to: '/classificados', label: 'Classificados' },
        { to: '/emails-log', label: 'E-mail' },
        { to: '/whatsapp', label: 'WhatsApp' },
        { to: '/fila-envios', label: 'Fila de envios' },
      ],
    },
    {
      label: 'Administração',
      children: [
        { to: '/assembleias', label: 'Assembleias' },
        { to: '/votacoes', label: 'Votações' },
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/templates', label: 'Templates' },
        { to: '/auditoria', label: 'Auditorias' },
        { to: '/ajuda', label: 'Ajuda' },
      ],
    },
  ],

  // ============================================================
  // Administradora — empresa que administra o condomínio
  // ============================================================
  administradora: [
    ...COMMON_TOP,
    {
      label: 'Visão geral',
      children: [
        { to: '/dashboard', label: 'Acompanhamento Geral' },
        { to: '/painel', label: 'Painel de trabalho' },
      ],
    },
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
        { to: '/acessos', label: 'Acessos autorizados' },
        { to: '/servicos', label: 'Prestação de Serviços' },
      ],
    },
    {
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
        { to: '/comunicados', label: 'Comunicados' },
        { to: '/classificados', label: 'Classificados' },
        { to: '/whatsapp', label: 'WhatsApp' },
        { to: '/fila-envios', label: 'Fila de envios' },
      ],
    },
    {
      label: 'Administração',
      children: [
        { to: '/assembleias', label: 'Assembleias' },
        { to: '/votacoes', label: 'Votações' },
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/templates', label: 'Templates' },
        { to: '/auditoria', label: 'Auditoria' },
        { to: '/ajuda', label: 'Ajuda' },
      ],
    },
  ],

  // ============================================================
  // Síndico — mesma estrutura da administradora
  // ============================================================
  sindico: [
    ...COMMON_TOP,
    {
      label: 'Visão geral',
      children: [
        { to: '/dashboard', label: 'Acompanhamento Geral' },
        { to: '/painel', label: 'Painel de trabalho' },
      ],
    },
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
        { to: '/acessos', label: 'Acessos autorizados' },
        { to: '/servicos', label: 'Prestação de Serviços' },
      ],
    },
    {
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
        { to: '/comunicados', label: 'Comunicados' },
        { to: '/classificados', label: 'Classificados' },
        { to: '/whatsapp', label: 'WhatsApp' },
        { to: '/fila-envios', label: 'Fila de envios' },
      ],
    },
    {
      label: 'Administração',
      children: [
        { to: '/assembleias', label: 'Assembleias' },
        { to: '/votacoes', label: 'Votações' },
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/templates', label: 'Templates' },
        { to: '/auditoria', label: 'Auditoria' },
        { to: '/ajuda', label: 'Ajuda' },
      ],
    },
  ],

  // ============================================================
  // Subsíndico — espelha o menu do síndico
  // ============================================================
  subsindico: [
    ...COMMON_TOP,
    {
      label: 'Visão geral',
      children: [
        { to: '/dashboard', label: 'Acompanhamento Geral' },
        { to: '/painel', label: 'Painel de trabalho' },
      ],
    },
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
        { to: '/acessos', label: 'Acessos autorizados' },
        { to: '/servicos', label: 'Prestação de Serviços' },
      ],
    },
    {
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
        { to: '/comunicados', label: 'Comunicados' },
        { to: '/classificados', label: 'Classificados' },
        { to: '/whatsapp', label: 'WhatsApp' },
        { to: '/fila-envios', label: 'Fila de envios' },
      ],
    },
    {
      label: 'Administração',
      children: [
        { to: '/assembleias', label: 'Assembleias' },
        { to: '/votacoes', label: 'Votações' },
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/templates', label: 'Templates' },
        { to: '/auditoria', label: 'Auditoria' },
        { to: '/ajuda', label: 'Ajuda' },
      ],
    },
  ],

  // ============================================================
  // Conselheiro — visão acompanhamento, sem operação
  // ============================================================
  conselheiro: [
    ...COMMON_TOP,
    {
      label: 'Acompanhamento',
      children: [
        { to: '/dashboard', label: 'Acompanhamento Geral' },
      ],
    },
    {
      label: 'Consulta',
      children: [
        { to: '/ocorrencias', label: 'Ocorrências' },
        { to: '/multas', label: 'Multas' },
        { to: '/notificacoes', label: 'Notificações' },
        { to: '/regimento', label: 'Regimento' },
      ],
    },
    {
      label: 'Condomínio',
      children: [
        { to: '/assembleias', label: 'Assembleias' },
        { to: '/votacoes', label: 'Votações' },
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
      ],
    },
  ],

  // ============================================================
  // Portaria
  // ============================================================
  portaria: [
    ...COMMON_TOP,
    { to: '/plantao', label: 'Plantão' },
    {
      label: 'Atendimento',
      children: [
        { to: '/encomendas', label: 'Serviços de Portaria' },
        { to: '/acessos', label: 'Acessos autorizados' },
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
      label: 'Comunicação',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/calendario', label: 'Calendário' },
        { to: '/chat', label: 'Chat interno' },
        { to: '/ajuda', label: 'Ajuda' },
      ],
    },
  ],

  // ============================================================
  // Ronda — só 3 itens, mantido flat
  // ============================================================
  ronda: [
    ...COMMON_TOP,
    {
      label: 'Registros',
      children: [
        { to: '/ocorrencias', label: 'Ocorrências' },
        { to: '/chamados', label: 'Chamados' },
      ],
    },
  ],

  // ============================================================
  // Morador
  // ============================================================
  morador: [
    ...COMMON_TOP,
    {
      label: 'Minha conta',
      children: [
        { to: '/meu-perfil', label: 'Meu perfil' },
        { to: '/ajuda', label: 'Ajuda' },
      ],
    },
    {
      label: 'Minhas pendências',
      children: [
        { to: '/multas', label: 'Minhas multas' },
        { to: '/encomendas', label: 'Minhas encomendas' },
        { to: '/notificacoes', label: 'Minhas notificações' },
      ],
    },
    {
      label: 'Acesso',
      children: [
        { to: '/acessos', label: 'Liberar acesso' },
        { to: '/classificados', label: 'Classificados' },
      ],
    },
    {
      label: 'Registros',
      children: [
        { to: '/ocorrencias', label: 'Ocorrências' },
      ],
    },
    {
      label: 'Condomínio',
      children: [
        { to: '/mural', label: 'Mural informativo' },
        { to: '/comunicados', label: 'Comunicados' },
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

// ============================================================
// Ícones por rota (emoji) — usados no launcher "Mais" e no bottom nav
// ============================================================
export const NAV_ICON: Record<string, string> = {
  '/': '🏠',
  '/dashboard': '📊',
  '/painel': '🗂',
  '/meu-perfil': '👤',
  '/ajuda': '❓',
  '/condominios': '🏢',
  '/unidades': '🚪',
  '/pessoas': '👥',
  '/veiculos': '🚗',
  '/pets': '🐾',
  '/regimento': '📜',
  '/ocorrencias': '⚠️',
  '/notificacoes': '📋',
  '/multas': '💰',
  '/chamados': '🛠',
  '/encomendas': '📦',
  '/acessos': '🔑',
  '/servicos': '🧰',
  '/mural': '📣',
  '/calendario': '📅',
  '/chat': '💬',
  '/comunicados': '📰',
  '/classificados': '🏷',
  '/whatsapp': '🟢',
  '/emails-log': '✉️',
  '/fila-envios': '📤',
  '/assembleias': '🏛',
  '/votacoes': '🗳',
  '/relatorios': '📈',
  '/templates': '🧩',
  '/auditoria': '🔍',
  '/mais': '⋯',
}

export function iconFor(to: string): string {
  return NAV_ICON[to] ?? '•'
}

/** Ajusta rótulos conforme contexto (ex.: "Condomínios"→"Condomínio" quando logado num condomínio). */
export function navLabel(to: string, label: string, emCondominio: boolean): string {
  if (to === '/condominios' && emCondominio) return 'Condomínio'
  return label
}

// Fundo do ícone no launcher — gradiente sólido, estilo ícone de app (classes
// completas porque o Tailwind faz purge das dinâmicas). Fallback slate.
export const NAV_COLOR: Record<string, string> = {
  '/': 'bg-gradient-to-br from-brand-500 to-brand-600',
  '/dashboard': 'bg-gradient-to-br from-sky-500 to-sky-600',
  '/painel': 'bg-gradient-to-br from-sky-500 to-sky-600',
  '/meu-perfil': 'bg-gradient-to-br from-brand-500 to-brand-600',
  '/ajuda': 'bg-gradient-to-br from-slate-500 to-slate-600',
  '/condominios': 'bg-gradient-to-br from-blue-500 to-blue-600',
  '/unidades': 'bg-gradient-to-br from-slate-500 to-slate-600',
  '/pessoas': 'bg-gradient-to-br from-indigo-500 to-indigo-600',
  '/veiculos': 'bg-gradient-to-br from-cyan-500 to-cyan-600',
  '/pets': 'bg-gradient-to-br from-orange-500 to-orange-600',
  '/regimento': 'bg-gradient-to-br from-amber-500 to-amber-600',
  '/ocorrencias': 'bg-gradient-to-br from-amber-500 to-amber-600',
  '/notificacoes': 'bg-gradient-to-br from-indigo-500 to-indigo-600',
  '/multas': 'bg-gradient-to-br from-red-500 to-red-600',
  '/chamados': 'bg-gradient-to-br from-orange-500 to-orange-600',
  '/encomendas': 'bg-gradient-to-br from-sky-500 to-sky-600',
  '/acessos': 'bg-gradient-to-br from-teal-500 to-teal-600',
  '/servicos': 'bg-gradient-to-br from-lime-500 to-lime-600',
  '/mural': 'bg-gradient-to-br from-pink-500 to-pink-600',
  '/calendario': 'bg-gradient-to-br from-violet-500 to-violet-600',
  '/chat': 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  '/comunicados': 'bg-gradient-to-br from-cyan-500 to-cyan-600',
  '/classificados': 'bg-gradient-to-br from-fuchsia-500 to-fuchsia-600',
  '/whatsapp': 'bg-gradient-to-br from-green-500 to-green-600',
  '/emails-log': 'bg-gradient-to-br from-blue-500 to-blue-600',
  '/fila-envios': 'bg-gradient-to-br from-slate-500 to-slate-600',
  '/assembleias': 'bg-gradient-to-br from-purple-500 to-purple-600',
  '/votacoes': 'bg-gradient-to-br from-amber-500 to-amber-600',
  '/relatorios': 'bg-gradient-to-br from-sky-500 to-sky-600',
  '/templates': 'bg-gradient-to-br from-slate-500 to-slate-600',
  '/auditoria': 'bg-gradient-to-br from-rose-500 to-rose-600',
  '/mais': 'bg-gradient-to-br from-slate-500 to-slate-600',
}

export function iconColorFor(to: string): string {
  return NAV_COLOR[to] ?? 'bg-gradient-to-br from-slate-500 to-slate-600'
}

// ============================================================
// Bottom nav (mobile): até 4 itens principais + "Mais"
// ============================================================
const BOTTOM_BY_ROLE: Record<Role, MenuLeaf[]> = {
  admin_onway:    [{ to: '/', label: 'Início' }, { to: '/painel', label: 'Painel' }, { to: '/ocorrencias', label: 'Ocorr.' }, { to: '/chat', label: 'Chat' }],
  administradora: [{ to: '/', label: 'Início' }, { to: '/painel', label: 'Painel' }, { to: '/ocorrencias', label: 'Ocorr.' }, { to: '/chat', label: 'Chat' }],
  sindico:        [{ to: '/', label: 'Início' }, { to: '/painel', label: 'Painel' }, { to: '/ocorrencias', label: 'Ocorr.' }, { to: '/chat', label: 'Chat' }],
  subsindico:     [{ to: '/', label: 'Início' }, { to: '/painel', label: 'Painel' }, { to: '/ocorrencias', label: 'Ocorr.' }, { to: '/chat', label: 'Chat' }],
  conselheiro:    [{ to: '/', label: 'Início' }, { to: '/dashboard', label: 'Painel' }, { to: '/ocorrencias', label: 'Ocorr.' }, { to: '/mural', label: 'Mural' }],
  portaria:       [{ to: '/', label: 'Início' }, { to: '/encomendas', label: 'Portaria' }, { to: '/acessos', label: 'Acessos' }, { to: '/chat', label: 'Chat' }],
  ronda:          [{ to: '/', label: 'Início' }, { to: '/ocorrencias', label: 'Ocorr.' }, { to: '/chamados', label: 'Chamados' }],
  morador:        [{ to: '/', label: 'Início' }, { to: '/encomendas', label: 'Encom.' }, { to: '/chat', label: 'Chat' }, { to: '/comunicados', label: 'Avisos' }],
}

export function bottomNavFor(role: Role): MenuLeaf[] {
  // "Início" sai da barra: o logo no topo já leva pra home/launcher (evita duplicar).
  const base = (BOTTOM_BY_ROLE[role] ?? []).filter((i) => i.to !== '/')
  return [...base, { to: '/mais', label: 'Mais' }]
}

export function roleLabel(role: Role): string {
  return {
    admin_onway: 'Administrador OnWay',
    administradora: 'Administradora',
    sindico: 'Síndico',
    subsindico: 'Subsíndico',
    conselheiro: 'Conselheiro',
    portaria: 'Portaria',
    ronda: 'Ronda',
    morador: 'Morador',
  }[role]
}
