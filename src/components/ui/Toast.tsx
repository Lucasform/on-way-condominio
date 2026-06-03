import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
  duration: number
}

interface ToastCtx {
  show: (input: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast precisa do <ToastProvider>')
  return ctx
}

const ICONS: Record<ToastTone, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
}

const STYLES: Record<ToastTone, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  error:   'border-red-500/40 bg-red-500/10 text-red-200',
  info:    'border-sky-500/40 bg-sky-500/10 text-sky-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id))
  }, [])

  const show = useCallback<ToastCtx['show']>((input) => {
    const id = nextId++
    const duration = input.duration ?? 4000
    setToasts((cur) => [...cur, { ...input, id, duration }])
    if (duration > 0) {
      window.setTimeout(() => remove(id), duration)
    }
  }, [remove])

  const ctx: ToastCtx = {
    show,
    success: (title, description) => show({ tone: 'success', title, description }),
    error:   (title, description) => show({ tone: 'error',   title, description }),
    info:    (title, description) => show({ tone: 'info',    title, description }),
    warning: (title, description) => show({ tone: 'warning', title, description }),
  }

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none"
        role="region"
        aria-label="Notificações"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 20)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      role="status"
      className={
        'pointer-events-auto rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ' +
        STYLES[toast.tone] +
        ' transition-all duration-200 ' +
        (entering ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0')
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-base leading-none mt-0.5">{ICONS[toast.tone]}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.description && (
            <div className="text-xs opacity-80 mt-0.5">{toast.description}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="opacity-60 hover:opacity-100 text-sm leading-none"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  )
}
