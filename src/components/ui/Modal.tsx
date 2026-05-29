import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Botões/links no rodapé, alinhados à direita. */
  footer?: ReactNode
  /** Mostra X no canto superior direito. */
  showClose?: boolean
  /** Largura. md = max-w-md, lg = max-w-lg. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

/**
 * Modal padronizado. Backdrop blur, ESC fecha, click fora fecha,
 * scroll travado no body, animação suave.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  showClose = true,
  size = 'md',
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={
          `w-full ${sizes[size]} rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ` +
          'animate-in fade-in zoom-in-95 duration-150'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-800">
            {title && <div className="text-base font-semibold text-slate-100 leading-tight">{title}</div>}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-500 hover:text-slate-100 transition shrink-0"
                aria-label="Fechar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="px-5 py-4 text-sm text-slate-200">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-900/60 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
