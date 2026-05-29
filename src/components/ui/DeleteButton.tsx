import type { ButtonHTMLAttributes } from 'react'
import Button from './Button'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
}

/**
 * Botão de exclusão padronizado. Ghost com hover vermelho discreto.
 * Pra ação destrutiva mais óbvia (em formulário), usar `<Button variant="danger">`.
 */
export default function DeleteButton({ label = 'Excluir', className = '', ...rest }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={label}
      leftIcon={<TrashIcon />}
      className={'hover:!text-red-300 hover:!bg-red-500/10 ' + className}
      {...rest}
    >
      {label}
    </Button>
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
