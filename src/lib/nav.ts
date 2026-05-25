import type { Role } from '../types/database'

export interface MenuItem {
  to: string
  label: string
}

const COMMON_TOP: MenuItem[] = [{ to: '/', label: 'Início' }]

const MENU_BY_ROLE: Record<Role, MenuItem[]> = {
  admin_onway: [
    ...COMMON_TOP,
    { to: '/painel', label: 'Painel' },
    { to: '/condominios', label: 'Condomínios' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/multas', label: 'Multas' },
    { to: '/encomendas', label: 'Encomendas' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/planos', label: 'Planos' },
  ],
  administradora: [
    ...COMMON_TOP,
    { to: '/painel', label: 'Painel' },
    { to: '/unidades', label: 'Unidades' },
    { to: '/pessoas', label: 'Pessoas' },
    { to: '/veiculos', label: 'Veículos' },
    { to: '/pets', label: 'Pets' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/multas', label: 'Multas' },
    { to: '/encomendas', label: 'Encomendas' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/regimento', label: 'Regimento' },
  ],
  sindico: [
    ...COMMON_TOP,
    { to: '/painel', label: 'Painel' },
    { to: '/unidades', label: 'Unidades' },
    { to: '/pessoas', label: 'Pessoas' },
    { to: '/veiculos', label: 'Veículos' },
    { to: '/pets', label: 'Pets' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/multas', label: 'Multas' },
    { to: '/encomendas', label: 'Encomendas' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/regimento', label: 'Regimento' },
  ],
  portaria: [
    ...COMMON_TOP,
    { to: '/encomendas', label: 'Encomendas' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
    { to: '/ocorrencias', label: 'Ocorrências' },
  ],
  ronda: [...COMMON_TOP, { to: '/ocorrencias', label: 'Ocorrências' }],
  morador: [
    ...COMMON_TOP,
    { to: '/meu-perfil', label: 'Meu perfil' },
    { to: '/ocorrencias', label: 'Ocorrências' },
    { to: '/multas', label: 'Minhas multas' },
    { to: '/encomendas', label: 'Minhas encomendas' },
    { to: '/mural', label: 'Mural' },
    { to: '/calendario', label: 'Calendário' },
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
