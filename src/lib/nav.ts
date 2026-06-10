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
        { to: '/chamados', label: 'Chamados' },
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

// Cor do "chip" do ícone no launcher (classes completas — Tailwind precisa delas
// estáticas pra não fazer purge). Fallback slate.
export const NAV_COLOR: Record<string, string> = {
  '/': 'bg-brand-500/15 text-brand-300',
  '/dashboard': 'bg-sky-500/15 text-sky-300',
  '/painel': 'bg-sky-500/15 text-sky-300',
  '/meu-perfil': 'bg-brand-500/15 text-brand-300',
  '/ajuda': 'bg-slate-500/15 text-slate-300',
  '/condominios': 'bg-blue-500/15 text-blue-300',
  '/unidades': 'bg-slate-500/15 text-slate-300',
  '/pessoas': 'bg-indigo-500/15 text-indigo-300',
  '/veiculos': 'bg-cyan-500/15 text-cyan-300',
  '/pets': 'bg-orange-500/15 text-orange-300',
  '/regimento': 'bg-amber-500/15 text-amber-300',
  '/ocorrencias': 'bg-amber-500/15 text-amber-300',
  '/notificacoes': 'bg-indigo-500/15 text-indigo-300',
  '/multas': 'bg-red-500/15 text-red-300',
  '/chamados': 'bg-orange-500/15 text-orange-300',
  '/encomendas': 'bg-sky-500/15 text-sky-300',
  '/acessos': 'bg-teal-500/15 text-teal-300',
  '/servicos': 'bg-lime-500/15 text-lime-300',
  '/mural': 'bg-pink-500/15 text-pink-300',
  '/calendario': 'bg-violet-500/15 text-violet-300',
  '/chat': 'bg-emerald-500/15 text-emerald-300',
  '/comunicados': 'bg-cyan-500/15 text-cyan-300',
  '/classificados': 'bg-fuchsia-500/15 text-fuchsia-300',
  '/whatsapp': 'bg-green-500/15 text-green-300',
  '/emails-log': 'bg-blue-500/15 text-blue-300',
  '/assembleias': 'bg-purple-500/15 text-purple-300',
  '/votacoes': 'bg-amber-500/15 text-amber-300',
  '/relatorios': 'bg-sky-500/15 text-sky-300',
  '/templates': 'bg-slate-500/15 text-slate-300',
  '/auditoria': 'bg-rose-500/15 text-rose-300',
  '/mais': 'bg-slate-500/15 text-slate-300',
}

export function iconColorFor(to: string): string {
  return NAV_COLOR[to] ?? 'bg-slate-500/15 text-slate-300'
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
  const base = BOTTOM_BY_ROLE[role] ?? [{ to: '/', label: 'Início' }]
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
