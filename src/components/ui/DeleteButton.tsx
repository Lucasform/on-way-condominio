import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
}

export default function DeleteButton({
  label = 'Excluir',
  className = '',
  ...rest
}: Props) {
  return (
    <button
      type="button"
      title={label}
      className={
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ' +
        'text-slate-500 dark:text-slate-400 ' +
        'hover:text-red-700 dark:hover:text-red-300 ' +
        'hover:bg-red-50 dark:hover:bg-red-500/10 ' +
        'transition disabled:opacity-50 disabled:cursor-not-allowed ' +
        className
      }
      {...rest}
    >
      <TrashIcon />
      <span>{label}</span>
    </button>
  )
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
