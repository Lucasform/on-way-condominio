import { Link } from 'react-router-dom'

/**
 * Botão flutuante "+" (só mobile) pra ação principal de uma lista.
 * No desktop a ação fica no PageHeader, então o FAB some (md:hidden).
 * Posicionado acima do bottom nav.
 */
export default function Fab({ to, label = 'Novo' }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white shadow-lg shadow-black/30 flex items-center justify-center text-3xl leading-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      +
    </Link>
  )
}
