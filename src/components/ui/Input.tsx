import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const inputCls =
  'w-full h-9 px-3 rounded-md bg-slate-950/60 border border-slate-700 ' +
  'text-sm text-slate-100 placeholder:text-slate-500 ' +
  'transition-colors ' +
  'hover:border-slate-600 ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const textareaCls = inputCls.replace('h-9 px-3', 'px-3 py-2')

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string
  children: ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block mt-1 text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${textareaCls} ${props.className ?? ''}`}
      rows={props.rows ?? 3}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />
}
