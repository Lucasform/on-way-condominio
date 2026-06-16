import {
  Home, LayoutDashboard, KanbanSquare, User, HelpCircle, Building2, DoorOpen, Users,
  Car, PawPrint, ScrollText, AlertTriangle, ClipboardList, Receipt, Wrench, Package,
  KeyRound, Briefcase, Megaphone, Calendar, MessageCircle, Newspaper, Tags, MessageSquare,
  Mail, Landmark, Vote, TrendingUp, FileText, ShieldCheck, LayoutGrid, Send, Circle,
  ConciergeBell, ToggleLeft, CreditCard,
} from 'lucide-react'
import type { ComponentType } from 'react'

type IconCmp = ComponentType<{ className?: string }>

/** Ícone (lucide, monocromático) por rota — estilo limpo/profissional. */
export const NAV_LUCIDE: Record<string, IconCmp> = {
  '/': Home,
  '/dashboard': LayoutDashboard,
  '/painel': KanbanSquare,
  '/meu-perfil': User,
  '/ajuda': HelpCircle,
  '/condominios': Building2,
  '/unidades': DoorOpen,
  '/pessoas': Users,
  '/veiculos': Car,
  '/pets': PawPrint,
  '/regimento': ScrollText,
  '/ocorrencias': AlertTriangle,
  '/notificacoes': ClipboardList,
  '/multas': Receipt,
  '/chamados': Wrench,
  '/encomendas': Package,
  '/acessos': KeyRound,
  '/servicos': Briefcase,
  '/mural': Megaphone,
  '/calendario': Calendar,
  '/chat': MessageCircle,
  '/comunicados': Newspaper,
  '/classificados': Tags,
  '/whatsapp': MessageSquare,
  '/emails-log': Mail,
  '/assembleias': Landmark,
  '/votacoes': Vote,
  '/relatorios': TrendingUp,
  '/templates': FileText,
  '/auditoria': ShieldCheck,
  '/funcionalidades': ToggleLeft,
  '/planos': CreditCard,
  '/mais': LayoutGrid,
  '/fila-envios': Send,
  '/plantao': ConciergeBell,
}

export function navIcon(to: string): IconCmp {
  return NAV_LUCIDE[to] ?? Circle
}
