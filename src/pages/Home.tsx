import { useAuth } from '../components/AuthProvider'
import { roleLabel } from '../lib/nav'

export default function Home() {
  const { user, perfil } = useAuth()

  return (
    <div className="px-8 py-10">
      <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-sky-500 bg-clip-text text-transparent">
        OnWay Condomínio
      </h1>
      <p className="mt-2 text-slate-400">
        Módulo administrativo — multas, notificações e IA.
      </p>

      <section className="mt-8 max-w-md rounded-lg border border-slate-800 bg-slate-900/40 p-5">
        <div className="text-sm text-slate-400">Logado como</div>
        <div className="mt-1 text-base font-medium text-slate-100">{user?.email}</div>
        {perfil && (
          <div className="mt-1 text-xs text-slate-500">
            Perfil: <span className="text-slate-300">{roleLabel(perfil.role)}</span>
            {perfil.condominio_id && (
              <span className="ml-2 opacity-60">· condomínio {perfil.condominio_id.slice(0, 8)}…</span>
            )}
          </div>
        )}
      </section>

      <p className="mt-10 text-xs text-slate-600">
        Esqueleto inicial · Fase 1 em construção
      </p>
    </div>
  )
}
