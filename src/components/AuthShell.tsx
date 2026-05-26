import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  title: string
  subtitle?: string
  footer?: ReactNode
}

export default function AuthShell({ children, title, subtitle, footer }: Props) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-sky-500 bg-clip-text text-transparent">
              OnWay Condomínio
            </h1>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold mb-1">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400 mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-2" />}

          {children}
        </div>

        {footer && (
          <div className="mt-5 text-center text-sm text-slate-400">{footer}</div>
        )}
      </div>
    </main>
  )
}
