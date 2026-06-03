import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmOptions {
  title?: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  tone?: 'primary' | 'danger'
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

const Ctx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

/**
 * Substituto Promise-based pra window.confirm. Mostra Modal padronizado.
 * Uso:
 *   const confirm = useConfirm()
 *   const ok = await confirm({ message: 'Apagar?', tone: 'danger' })
 *   if (!ok) return
 */
export function useConfirm() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm precisa do <ConfirmProvider>')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  function handleClose(ok: boolean) {
    if (!pending) return
    pending.resolve(ok)
    setPending(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal
        open={!!pending}
        onClose={() => handleClose(false)}
        title={pending?.title ?? 'Confirmar'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => handleClose(false)}>
              {pending?.cancelText ?? 'Cancelar'}
            </Button>
            <Button
              variant={pending?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => handleClose(true)}
              autoFocus
            >
              {pending?.confirmText ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-200 whitespace-pre-wrap">
          {pending?.message}
        </div>
      </Modal>
    </Ctx.Provider>
  )
}
