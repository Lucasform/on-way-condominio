export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center px-6">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-sky-500 bg-clip-text text-transparent">
          OnWay Condomínio
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Módulo administrativo — multas, notificações e IA.
        </p>
        <p className="mt-8 text-sm text-slate-500">
          Esqueleto inicial · Tailwind + React Router + Supabase
        </p>
      </div>
    </main>
  )
}
