import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { getPushStatus } from '../lib/push'

interface Step {
  done: boolean
  label: string
  cta: string
  to: string
}

const DISMISS_STAFF = 'onboarding_dismissed'
const DISMISS_MORADOR = 'onboarding_morador_dismissed'

export default function OnboardingChecklist() {
  const { user, perfil } = useAuth()
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [titulo, setTitulo] = useState('🚀 Configure seu condomínio')
  const [dismissKey, setDismissKey] = useState(DISMISS_STAFF)

  useEffect(() => {
    if (!perfil) return

    const isStaff = ['administradora', 'sindico', 'subsindico'].includes(perfil.role)
    const isMorador = perfil.role === 'morador'

    if (!isStaff && !isMorador) return
    if (!perfil.condominio_id) return

    const key = isStaff ? DISMISS_STAFF : DISMISS_MORADOR
    setDismissKey(key)
    if (localStorage.getItem(key) === '1') {
      setDismissed(true)
      return
    }

    let mounted = true
    ;(async () => {
      const cid = perfil.condominio_id!

      if (isStaff) {
        setTitulo('🚀 Configure seu condomínio')
        const [{ count: unidades }, { count: pessoas }, { count: convites }, { count: regimento }] = await Promise.all([
          supabase.from('unidades').select('*', { count: 'exact', head: true }).eq('condominio_id', cid),
          supabase.from('pessoas').select('*', { count: 'exact', head: true }).eq('condominio_id', cid),
          supabase.from('convites_condominio').select('*', { count: 'exact', head: true }).eq('condominio_id', cid),
          supabase.from('regimento_artigos').select('*', { count: 'exact', head: true }).eq('condominio_id', cid),
        ])
        if (!mounted) return
        setSteps([
          { done: (unidades ?? 0) > 0, label: 'Cadastrar unidades do condomínio', cta: 'Cadastrar unidades', to: '/unidades/novo' },
          { done: (pessoas ?? 0) > 0, label: 'Cadastrar primeiras pessoas (moradores/funcionários)', cta: 'Cadastrar pessoa', to: '/pessoas/novo' },
          { done: (convites ?? 0) > 0, label: 'Gerar código de convite pros moradores se cadastrarem sozinhos', cta: 'Gerar código', to: `/condominios/${cid}` },
          { done: (regimento ?? 0) > 0, label: 'Cadastrar regimento interno (pra IA analisar ocorrências)', cta: 'Adicionar artigo', to: '/regimento/novo' },
        ])
        return
      }

      // Morador: tarefas de onboarding pessoal
      setTitulo('👋 Bem-vindo! Complete seu cadastro')
      if (!user) return
      // 1. Perfil: avatar + telefone preenchidos
      const perfilCompleto = Boolean(perfil.telefone) && Boolean(perfil.avatar_url)
      // 2. Veiculo cadastrado pra unidade
      let veiculoOk = false
      try {
        const { data: pessoaUser } = await supabase
          .from('pessoas')
          .select('id, unidade_id')
          .eq('user_id', user.id)
          .eq('condominio_id', cid)
          .maybeSingle()
        if (pessoaUser?.unidade_id) {
          const { count } = await supabase
            .from('veiculos')
            .select('*', { count: 'exact', head: true })
            .eq('unidade_id', pessoaUser.unidade_id)
          veiculoOk = (count ?? 0) > 0
        }
      } catch {
        // ignora
      }
      // 3. Push ativado
      let pushOk = false
      try {
        const status = await getPushStatus()
        pushOk = status.subscribed
      } catch {
        // ignora
      }
      // 4. Primeira interacao no chat (mensagem propria OU conversa iniciada)
      let chatOk = false
      try {
        const { count } = await supabase
          .from('mensagens')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        chatOk = (count ?? 0) > 0
      } catch {
        // ignora
      }

      if (!mounted) return
      setSteps([
        {
          done: perfilCompleto,
          label: 'Completar perfil (foto e telefone)',
          cta: 'Editar perfil',
          to: '/meu-perfil',
        },
        {
          done: veiculoOk,
          label: 'Cadastrar seu veículo (opcional, ajuda a portaria)',
          cta: 'Cadastrar',
          to: '/veiculos/novo',
        },
        {
          done: pushOk,
          label: 'Ativar notificações push (avisos da administração)',
          cta: 'Ativar',
          to: '/meu-perfil',
        },
        {
          done: chatOk,
          label: 'Mandar a primeira mensagem no chat com a administração',
          cta: 'Abrir chat',
          to: '/chat',
        },
      ])
    })()
    return () => { mounted = false }
  }, [perfil, user])

  if (dismissed || !steps) return null
  const completed = steps.filter((s) => s.done).length
  const total = steps.length
  if (completed === total) return null

  return (
    <section className="mb-6 rounded-lg border border-brand-700/30 bg-brand-50 dark:bg-brand-700/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {titulo}
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {completed} de {total} etapas concluídas. Termine pra liberar todos os recursos.
          </p>
        </div>
        <button
          onClick={() => { localStorage.setItem(dismissKey, '1'); setDismissed(true) }}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          title="Esconder permanentemente"
        >
          Dispensar ✕
        </button>
      </div>

      <div className="mt-3 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-700 transition-all"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className={`flex items-center gap-2 ${s.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${s.done ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {s.done ? '✓' : i + 1}
              </span>
              {s.label}
            </span>
            {!s.done && (
              <Link
                to={s.to}
                className="text-xs px-3 py-1 rounded bg-brand-700 hover:bg-brand-800 text-white whitespace-nowrap"
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
