import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Modal from './Modal'
import Button from './Button'

export interface PromptOptions {
  title?: string
  message?: ReactNode
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  /** Se fornecido, renderiza <select> em vez de <input>. */
  options?: { value: string; label: string }[]
  optional?: boolean
}

interface Pending extends PromptOptions {
  resolve: (value: string | null) => void
}

const Ctx = createContext<((opts: PromptOptions) => Promise<string | null>) | null>(null)

/**
 * Substituto Promise-based pra window.prompt.
 * Retorna a string digitada, ou null se cancelado.
 * Uso:
 *   const prompt = usePrompt()
 *   const valor = await prompt({ title: 'Novo nome', defaultValue: nome })
 *   if (valor === null) return
 */
export function usePrompt() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePrompt precisa do <PromptProvider>')
  return ctx
}

export function PromptProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setValue(opts.defaultValue ?? (opts.options?.[0]?.value ?? ''))
      setPending({ ...opts, resolve })
    })
  }, [])

  useEffect(() => {
    if (pending) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
        selectRef.current?.focus()
      }, 50)
    }
  }, [pending])

  function handleConfirm() {
    if (!pending) return
    pending.resolve(value || (pending.optional ? '' : null) || value)
    setPending(null)
    setValue('')
  }

  function handleCancel() {
    if (!pending) return
    pending.resolve(null)
    setPending(null)
    setValue('')
  }

  return (
    <Ctx.Provider value={prompt}>
      {children}
      <Modal
        open={!!pending}
        onClose={handleCancel}
        title={pending?.title ?? 'Informar valor'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={handleCancel}>
              {pending?.cancelText ?? 'Cancelar'}
            </Button>
            <Button variant="primary" onClick={handleConfirm} autoFocus={false}>
              {pending?.confirmText ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {pending?.message && (
            <p className="text-sm text-slate-300">{pending.message}</p>
          )}
          {pending?.options ? (
            <select
              ref={selectRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            >
              {pending.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={pending?.placeholder ?? ''}
              className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-slate-500"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          )}
        </div>
      </Modal>
    </Ctx.Provider>
  )
}
