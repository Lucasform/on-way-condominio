import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { roleLabel } from '../lib/nav'
import { listMultas } from '../lib/multas'
import { listEncomendas } from '../lib/encomendas'
import { listEventos } from '../lib/eventos'
import { listVotacoes } from '../lib/votacoes'
import { listChamados } from '../lib/chamados'
import type { Multa } from '../types/multa'
import type { Encomenda } from '../types/encomenda'
import type { Evento } from '../types/evento'
import type { Votacao } from '../types/votacao'
import type { Chamado } from '../types/chamado'
import OnboardingChecklist from '../components/OnboardingChecklist'
import AdminHome from '../components/AdminHome'

export default function Home() {
  const { user, perfil } = useAuth()

  if (perfil?.role === 'morador') {
    return <MoradorHome />
  }

  // Admin sem condomínio assumido → escolhe um
  if (perfil?.role === 'admin_onway' && !perfil.condominio_id) {
    return <AdminHome />
  }

  // Demais perfis: home simples (eles têm Dashboard/Painel próprios)
  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <OnboardingChecklist />

      <h1 className="text-3xl font-bold tracking-tight text-brand-700 dark:text-brand-400">
        OnWay <span className="text-slate-700 dark:text-slate-300">Condomínio</span>
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Bem-vindo, {perfil?.nome_exibicao ?? user?.email}.
      </p>

      <section className="mt-8 max-w-md rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5">
        <div className="text-sm text-slate-500 dark:text-slate-400">Logado como</div>
        <div className="mt-1 text-base font-medium text-slate-900 dark:text-slate-100">{user?.email}</div>
        {perfil && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            Perfil: <span className="text-slate-700 dark:text-slate-300 font-medium">{roleLabel(perfil.role)}</span>
            {perfil.condominio_id && (
              <span className="ml-2 opacity-60">· condomínio {perfil.condominio_id.slice(0, 8)}…</span>
            )}
          </div>
        )}
      </section>

      {perfil && ['admin_onway', 'administradora', 'sindico'].includes(perfil.role) && (
        <>
          <div className="mt-6 flex gap-3 flex-wrap">
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium transition shadow-sm"
            >
              📊 Ir pro Dashboard
            </Link>
            <Link
              to="/painel"
              className="px-4 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              🗂 Abrir Painel Kanban
            </Link>
          </div>

        </>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Home específica do MORADOR — dashboard pessoal
// ----------------------------------------------------------------

function MoradorHome() {
  const { user, perfil } = useAuth()
  const [multas, setMultas] = useState<Multa[]>([])
  const [encomendas, setEncomendas] = useState<Encomenda[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [votacoes, setVotacoes] = useState<Votacao[]>([])
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // RLS garante que só vê o próprio
        const [m, e, ev, v, c] = await Promise.all([
          listMultas(),
          listEncomendas({ status: 'aguardando' }),
          listEventos({ desde: new Date().toISOString() }),
          listVotacoes({ status: 'aberta' }),
          listChamados(),
        ])
        if (!mounted) return
        setMultas(m)
        setEncomendas(e)
        setEventos(ev.slice(0, 5))
        setVotacoes(v)
        setChamados(c.filter((x) => x.aberto_por === user?.id))
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [user])

  const multasAbertas = multas.filter((m) => m.status === 'aplicada' || m.status === 'contestada' || m.status === 'em_analise')
  const totalAbertas = multasAbertas.reduce((s, m) => s + Number(m.valor), 0)

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100">
        Olá, {perfil?.nome_exibicao ?? 'morador'} 👋
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Resumo do que está acontecendo pra você no condomínio.
      </p>

      {loading ? (
        <div className="mt-8 text-slate-400">Carregando...</div>
      ) : (
        <>
          {/* Atenção imediata */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <PersonalCard
              icon="💰"
              label="Multas em aberto"
              value={multasAbertas.length}
              detail={
                multasAbertas.length > 0
                  ? `R$ ${totalAbertas.toFixed(2).replace('.', ',')}`
                  : 'tudo em dia 👍'
              }
              link="/multas"
              accent={multasAbertas.length > 0 ? 'red' : 'emerald'}
            />
            <PersonalCard
              icon="📦"
              label="Encomendas pra retirar"
              value={encomendas.length}
              detail={encomendas.length > 0 ? 'na portaria' : 'nenhuma agora'}
              link="/encomendas"
              accent={encomendas.length > 0 ? 'sky' : 'default'}
            />
            <PersonalCard
              icon="🗳"
              label="Votações abertas"
              value={votacoes.length}
              detail={votacoes.length > 0 ? 'sua opinião conta!' : '—'}
              link="/votacoes"
              accent={votacoes.length > 0 ? 'amber' : 'default'}
            />
          </div>

          {/* Ações rápidas */}
          <div className="mt-6">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Ações rápidas
            </div>
            <div className="flex flex-wrap gap-2">
              <QuickAction to="/ocorrencias/novo" label="📋 Registrar ocorrência" />
              <QuickAction to="/chamados/novo" label="🛠 Abrir chamado" />
              <QuickAction to="/meu-perfil" label="👤 Editar meu perfil" />
              <QuickAction to="/mural" label="📣 Ver mural" />
            </div>
          </div>

          {/* Próximos eventos */}
          {eventos.length > 0 && (
            <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-sm font-semibold text-slate-200 mb-3">📅 Próximos eventos</div>
              <ul className="space-y-2">
                {eventos.map((e) => (
                  <li key={e.id} className="text-sm">
                    <Link
                      to="/calendario"
                      className="flex justify-between items-baseline hover:bg-slate-800/40 px-2 py-1.5 rounded -mx-2 transition"
                    >
                      <span className="text-slate-200">{e.titulo}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(e.data_inicio).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Meus chamados ativos */}
          {chamados.some((c) => c.status !== 'resolvido' && c.status !== 'cancelado') && (
            <section className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-sm font-semibold text-slate-200 mb-3">🛠 Meus chamados ativos</div>
              <ul className="space-y-2">
                {chamados
                  .filter((c) => c.status !== 'resolvido' && c.status !== 'cancelado')
                  .slice(0, 5)
                  .map((c) => (
                    <li key={c.id} className="text-sm">
                      <Link
                        to={`/chamados/${c.id}`}
                        className="flex justify-between items-baseline hover:bg-slate-800/40 px-2 py-1.5 rounded -mx-2 transition"
                      >
                        <span className="text-slate-200">{c.titulo}</span>
                        <span className="text-xs text-slate-400">{c.status.replace('_', ' ')}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ----------------------------------------------------------------

function PersonalCard({
  icon,
  label,
  value,
  detail,
  link,
  accent = 'default',
}: {
  icon: string
  label: string
  value: number
  detail: string
  link: string
  accent?: 'default' | 'red' | 'sky' | 'amber' | 'emerald'
}) {
  const accentMap = {
    default: 'border-slate-800',
    red: 'border-red-500/40 bg-red-500/5',
    sky: 'border-sky-500/40 bg-sky-500/5',
    amber: 'border-amber-500/40 bg-amber-500/5',
    emerald: 'border-emerald-500/40 bg-emerald-500/5',
  }
  return (
    <Link
      to={link}
      className={`block rounded-lg border ${accentMap[accent]} bg-slate-900/40 p-4 hover:border-slate-600 transition`}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-2xl leading-none">{icon}</span>
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{value}</span>
            <span className="text-xs text-slate-400">{detail}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function QuickAction({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700 text-sm text-slate-200 hover:border-slate-500 transition"
    >
      {label}
    </Link>
  )
}
