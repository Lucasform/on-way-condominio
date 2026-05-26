import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

interface Props {
  children: ReactNode
  title: string
  subtitle?: string
  footer?: ReactNode
}

export default function AuthShell({ children, title, subtitle, footer }: Props) {
  return (
    <main className="min-h-screen flex flex-col bg-brand-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Theme toggle no canto superior direito */}
      <div className="absolute top-4 right-4">
        <ThemeToggle compact />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Marca centralizada */}
          <div className="flex flex-col items-center mb-6">
            <Link to="/" className="block">
              <Logo size={72} />
            </Link>
            <div className="mt-3 text-center">
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-brand-700 dark:text-brand-400">OnWay</span>
                <span className="text-slate-700 dark:text-slate-300"> Condomínio</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                Gestão moderna do seu condomínio
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-lg dark:shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{subtitle}</p>
            )}
            {!subtitle && <div className="mb-2" />}

            {children}
          </div>

          {footer && (
            <div className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
              {footer}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
