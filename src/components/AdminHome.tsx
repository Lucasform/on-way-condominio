import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { traduzErro } from '../lib/errorMessages'
import AdminKPIs from './AdminKPIs'

interface CondoUso {
  condominio_id: string
  nome: string
  plano: string
  unidades_atual: number
  unidades_max: number
  pessoas_atual: number
  pessoas_max: number
  usuarios_atual: number
  usuarios_max: number
  logo_url?: string | null
}

const CATALOGO_ATALHOS = [
  { id: 'condominios',    label: '🏢 Gerenciar condomínios', to: '/condominios' },
  { id: 'dashboard',      label: '📊 Dashboard global',       to: '/dashboard' },
  { id: 'painel',         label: '🛠 Painel de serviços',     to: '/painel' },
  { id: 'parceiros',      label: '🤝 Parceiros',              to: '/parceiros' },
  { id: 'relatorios',     label: '📋 Relatórios',             to: '/relatorios' },
  { id: 'auditoria',      label: '🔍 Auditoria',              to: '/auditoria' },
  { id: 'assinaturas',    label: '💳 Assinaturas',            to: '/assinaturas' },
  { id: 'emails-log',     label: '📧 Log de e-mails',         to: '/emails-log' },
  { id: 'funcionalidades',label: '⚙️ Funcionalidades',        to: '/funcionalidades' },
  { id: 'suporte',        label: '❓ Suporte',                to: '/suporte' },
  { id: 'fila-envios',    label: '📤 Fila de envios',         to: '/fila-envios' },
] as const

const ATALHOS_PADRAO = ['condominios', 'dashboard', 'painel']

export default function AdminHome() {
  const { perfil, refreshPerfil, user } = useAuth()
  const [condos, setCondos] = useState<CondoUso[]>([])
  const [loading, setLoading] = useState(true)
  const [trocando, setTrocando] = useState<string | null>(null)
  const [editandoAtalhos, setEditandoAtalhos] = useState(false)
  const [atalhosSelecionados, setAtalhosSelecionados] = useState<string[]>(ATALHOS_PADRAO)

  const storageKey = `adminHome_atalhos_${user?.id ?? 'anon'}`

  useEffect(() => {
    if (!user) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setAtalhosSelecionados(JSON.parse(saved) as string[])
    } catch { /* usa padrão */ }
  }, [user, storageKey])

  function toggleAtalho(id: string) {
    setAtalhosSelecionados(prev => {
      const next = prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: uso } = await supabase.from('condominio_uso').select('*').order('nome')
      const { data: meta } = await supabase.from('condominios').select('id, logo_url')
      if (!mounted) return
      const merged = (uso ?? []).map((u) => ({
        ...(u as CondoUso),
        logo_url: meta?.find((m) => m.id === u.condominio_id)?.logo_url ?? null,
      }))
      setCondos(merged)
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  async function assumir(condoId: string) {
    setTrocando(condoId)
    const { error } = await supabase.rpc('set_active_condominio', { p_condominio: condoId })
    if (error) {
      alert(traduzErro(error))
      setTrocando(null)
      return
    }
    await refreshPerfil()
    window.location.href = '/'
  }

  async function sairViewAs() {
    setTrocando('exit')
    const { error } = await supabase.rpc('exit_view_as')
    if (error) {
      alert(traduzErro(error))
      setTrocando(null)
      return
    }
    await refreshPerfil()
    window.location.href = '/'
  }

  // Se admin já está em view-as, redireciona pra Home do condomínio
  // (mas com banner indicando)
  const emViewAs = !!perfil?.condominio_id

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-6xl mx-auto">
      <div className="relative mb-8 text-center">
        <h1 className="text-3xl font-bold text-brand-400">
          Administrador OnWay
        </h1>
        <div className="mt-1 text-[11px] text-slate-500">
          Logado como {user?.email}
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {emViewAs
            ? `Você está vendo o condomínio "${condos.find((c) => c.condominio_id === perfil?.condominio_id)?.nome ?? '...'}". Volte pra visão global ou troque.`
            : 'Escolha um condomínio pra entrar ou veja métricas globais.'}
        </p>
        {emViewAs && (
          <button
            onClick={sairViewAs}
            disabled={trocando !== null}
            className="absolute right-0 top-0 px-4 py-2 rounded-md bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700"
          >
            ← Voltar pra visão global
          </button>
        )}
      </div>

      <AdminKPIs />

      <div className="mb-8 mt-6">
        <div className="flex flex-wrap justify-center gap-3">
          {CATALOGO_ATALHOS.filter(a => atalhosSelecionados.includes(a.id)).map(a => (
            <Link
              key={a.id}
              to={a.to}
              className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-700"
            >
              {a.label}
            </Link>
          ))}
          <button
            onClick={() => setEditandoAtalhos(v => !v)}
            title="Personalizar atalhos"
            className={`px-3 py-2 rounded-md border text-sm font-medium transition ${
              editandoAtalhos
                ? 'bg-brand-700 border-brand-600 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            ✏️
          </button>
        </div>

        {editandoAtalhos && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 max-w-xl mx-auto">
            <p className="text-xs text-slate-400 mb-3 text-center">Escolha quais atalhos aparecem na sua tela inicial</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATALOGO_ATALHOS.map(a => {
                const ativo = atalhosSelecionados.includes(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAtalho(a.id)}
                    className={`px-3 py-2 rounded text-xs font-medium text-left transition border ${
                      ativo
                        ? 'bg-brand-700/30 border-brand-600 text-brand-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {ativo ? '✓ ' : ''}{a.label}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 text-center">
              <button
                onClick={() => setEditandoAtalhos(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
        Condomínios ({condos.length})
      </h2>

      {loading ? (
        <div className="text-slate-500">Carregando...</div>
      ) : condos.length === 0 ? (
        <div className="rounded-lg border border-slate-800 p-8 text-center bg-slate-900/40">
          <p className="text-slate-400">Nenhum condomínio cadastrado ainda.</p>
          <Link
            to="/condominios/novo"
            className="mt-3 inline-block px-4 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium"
          >
            + Cadastrar primeiro condomínio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {condos.map((c) => {
            const ativo = c.condominio_id === perfil?.condominio_id
            return (
              <div
                key={c.condominio_id}
                className={`rounded-lg border ${ativo ? 'border-brand-700 ring-1 ring-brand-700' : 'border-slate-800'} bg-slate-900/40 p-4 flex flex-col gap-3 hover:border-brand-700 transition`}
              >
                <div className="flex items-center gap-3">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="w-12 h-12 rounded object-contain bg-slate-800 p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-brand-700/20 flex items-center justify-center text-brand-400 text-xl">🏢</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-100 truncate">{c.nome}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Unid." val={c.unidades_atual} />
                  <Stat label="Pessoas" val={c.pessoas_atual} />
                  <Stat label="Users" val={c.usuarios_atual} />
                </div>

                <div className="flex gap-2 pt-2 mt-auto">
                  <button
                    onClick={() => assumir(c.condominio_id)}
                    disabled={trocando !== null || ativo}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition ${
                      ativo
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-default'
                        : 'bg-brand-700 hover:bg-brand-800 text-white'
                    } disabled:opacity-50`}
                  >
                    {ativo ? '✓ Em uso' : trocando === c.condominio_id ? '...' : 'Entrar nesse condomínio'}
                  </button>
                  <Link
                    to={`/condominios/${c.condominio_id}`}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    ⚙
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, val }: { label: string; val: number }) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="font-mono text-slate-300">{val}</div>
    </div>
  )
}
