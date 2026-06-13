import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  listConversas,
  createConversa,
  createConversasUnidadeProprietarios,
  unreadCountsByConversa,
  ASSUNTO_LABEL,
  STATUS_LABEL,
} from '../lib/chat'
import type { AssuntoConversa, Conversa, StatusConversa } from '../types/chat'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import { listPessoas } from '../lib/pessoas'
import { supabase } from '../lib/supabase'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Field, TextArea, Select } from '../components/ui/Input'
import { CardListSkeleton } from '../components/ui/Skeleton'

const STATUS_CLASS: Record<StatusConversa, string> = {
  aberta: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  aguardando_humano: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  em_atendimento: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  encerrada: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

export default function Chat() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const isMorador = perfil?.role === 'morador'
  const isStaff = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | StatusConversa>('')
  const [rows, setRows] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mapa morador_user_id -> nome (resolvido via perfis+pessoas, com cache leve)
  const [nomesMorador, setNomesMorador] = useState<Record<string, string>>({})
  const [assigneeNomes, setAssigneeNomes] = useState<Record<string, string>>({})
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({})
  const [busca, setBusca] = useState('')

  // Form de nova conversa (morador)
  const [showNova, setShowNova] = useState(false)
  const [novaAssunto, setNovaAssunto] = useState<AssuntoConversa>('outro')
  const [novaMsg, setNovaMsg] = useState('')
  const [criando, setCriando] = useState(false)

  // Form de nova conversa iniciada pelo staff
  const [showStaffNova, setShowStaffNova] = useState(false)
  const [destinoTipo, setDestinoTipo] = useState<'pessoa' | 'unidade'>('pessoa')
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [proprietarios, setProprietarios] = useState<Array<Pessoa & { unidade_label: string }>>([])
  const [buscaPessoa, setBuscaPessoa] = useState('')
  const [comboAberto, setComboAberto] = useState(false)
  const [pessoaSelecionada, setPessoaSelecionada] = useState<Pessoa | null>(null)
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string>('')
  const [staffAssunto, setStaffAssunto] = useState<AssuntoConversa>('outro')
  const [staffMsg, setStaffMsg] = useState('')
  const comboRef = useRef<HTMLDivElement>(null)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [polindo, setPolindo] = useState(false)

  async function melhorarComAgente() {
    if (!staffMsg.trim()) {
      setStaffError('Escreva um esboço antes de chamar o Agente.')
      return
    }
    setPolindo(true)
    setStaffError(null)
    try {
      const { data, error: e } = await supabase.functions.invoke('improve-template', {
        body: {
          tipo: 'chat',
          corpo: staffMsg.trim(),
          condominio_id: perfil?.condominio_id ?? undefined,
        },
      })
      if (e) throw e
      if (data?.error) throw new Error(data.error)
      if (typeof data?.corpo === 'string') setStaffMsg(data.corpo)
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : 'Erro ao melhorar com o Agente.')
    } finally {
      setPolindo(false)
    }
  }

  // fecha combo ao clicar fora
  useEffect(() => {
    if (!comboAberto) return
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setComboAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [comboAberto])

  // carrega proprietarios e unidades quando staff abre o form
  useEffect(() => {
    if (!showStaffNova || !perfil?.condominio_id) return
    const cid = isAdmin && scopeId ? scopeId : perfil.condominio_id
    Promise.all([
      listUnidades({ condominio_id: cid, ativo: true }),
      listPessoas({ condominio_id: cid, ativo: true }),
    ])
      .then(([us, ps]) => {
        setUnidades(us)
        const propsList = ps
          .filter((p) => p.relacao_unidade === 'proprietario' && !!p.user_id)
          .map((p) => {
            const u = us.find((x) => x.id === p.unidade_id)
            const label = u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : '—'
            return { ...p, unidade_label: label }
          })
        setProprietarios(propsList)
      })
      .catch(() => {})
  }, [showStaffNova, perfil?.condominio_id, isAdmin, scopeId])

  const proprietariosFiltrados = useMemo(() => {
    const q = buscaPessoa.trim().toLowerCase()
    if (!q) return proprietarios
    return proprietarios.filter((p) =>
      p.nome.toLowerCase().includes(q) || p.unidade_label.toLowerCase().includes(q),
    )
  }, [proprietarios, buscaPessoa])

  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => {
          setCondos(cs)
          if (cs.length && !scopeId) setScopeId(cs[0].id)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listConversas({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        status: statusFilter || undefined,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, statusFilter])

  // Resolve nomes dos moradores (e assignees) das conversas
  useEffect(() => {
    if (rows.length === 0) return
    const moradorIds = Array.from(new Set(rows.map((r) => r.morador_user_id).filter((id) => !!id && !nomesMorador[id])))
    const assigneeIds = Array.from(new Set(rows.map((r) => r.atribuida_para).filter((id): id is string => !!id && !assigneeNomes[id])))
    const all = Array.from(new Set([...moradorIds, ...assigneeIds]))
    if (all.length === 0) return
    ;(async () => {
      const { data: perfis } = await supabase
        .from('perfis')
        .select('id, nome_exibicao, role')
        .in('id', all)
      const moradorPerfilIds = (perfis ?? []).filter((p) => p.role === 'morador').map((p) => p.id)
      let pessoasPorUser: Record<string, string> = {}
      if (moradorPerfilIds.length > 0) {
        const { data: pessoas } = await supabase
          .from('pessoas')
          .select('user_id, nome')
          .in('user_id', moradorPerfilIds)
        pessoasPorUser = Object.fromEntries((pessoas ?? []).map((p) => [p.user_id, p.nome]))
      }
      setNomesMorador((prev) => {
        const novo = { ...prev }
        for (const id of moradorIds) {
          const pf = (perfis ?? []).find((p) => p.id === id)
          novo[id] = pessoasPorUser[id] ?? pf?.nome_exibicao ?? 'Morador'
        }
        return novo
      })
      setAssigneeNomes((prev) => {
        const novo = { ...prev }
        for (const id of assigneeIds) {
          const pf = (perfis ?? []).find((p) => p.id === id)
          novo[id] = pf?.nome_exibicao ?? 'Staff'
        }
        return novo
      })
    })().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // Conta mensagens não-lidas por conversa pro usuário atual
  useEffect(() => {
    if (!user || rows.length === 0) { setNaoLidas({}); return }
    unreadCountsByConversa(user.id, rows.map((r) => r.id))
      .then(setNaoLidas)
      .catch(() => {})
  }, [rows, user])

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((c) => {
      const nome = nomesMorador[c.morador_user_id]?.toLowerCase() ?? ''
      return nome.includes(q) || ASSUNTO_LABEL[c.assunto].toLowerCase().includes(q)
    })
  }, [rows, busca, nomesMorador])

  async function handleStaffEnviar(e: FormEvent) {
    e.preventDefault()
    if (!user || !perfil?.condominio_id) return
    if (!staffMsg.trim()) { setStaffError('Escreva a mensagem.'); return }
    setStaffError(null)
    setCriando(true)
    try {
      if (destinoTipo === 'pessoa') {
        if (!pessoaSelecionada || !pessoaSelecionada.user_id) {
          setStaffError('Selecione um proprietário com acesso ao app.'); return
        }
        const conv = await createConversa({
          condominio_id: perfil.condominio_id,
          morador_user_id: pessoaSelecionada.user_id,
          assunto: staffAssunto,
          primeira_mensagem: staffMsg,
          autor_tipo: 'staff',
          autor_id: user.id,
          skip_bot: true,
        })
        navigate(`/chat/${conv.id}`)
      } else {
        if (!unidadeSelecionada) { setStaffError('Selecione a unidade.'); return }
        const { criadas, sem_acesso } = await createConversasUnidadeProprietarios({
          condominio_id: perfil.condominio_id,
          unidade_id: unidadeSelecionada,
          assunto: staffAssunto,
          mensagem: staffMsg,
          staff_user_id: user.id,
        })
        if (criadas.length === 0) {
          setStaffError('Nenhum proprietário com acesso ao app encontrado nessa unidade.')
          return
        }
        const msg = `${criadas.length} conversa${criadas.length > 1 ? 's' : ''} criada${criadas.length > 1 ? 's' : ''}.` +
          (sem_acesso > 0 ? ` ${sem_acesso} sem acesso ao app foram ignoradas.` : '')
        alert(msg)
        setShowStaffNova(false)
        setStaffMsg('')
        setUnidadeSelecionada('')
        setPessoaSelecionada(null)
        await reload()
      }
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setCriando(false)
    }
  }

  async function handleCriar(e: FormEvent) {
    e.preventDefault()
    if (!user || !perfil?.condominio_id) return
    if (!novaMsg.trim()) return
    setCriando(true)
    try {
      const conv = await createConversa({
        condominio_id: perfil.condominio_id,
        morador_user_id: user.id,
        assunto: novaAssunto,
        primeira_mensagem: novaMsg,
      })
      navigate(`/chat/${conv.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao abrir conversa.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={isMorador ? 'Minhas conversas' : 'Conversas do condomínio'}
        subtitle={
          isMorador
            ? 'Fale com a administração. Resposta direta no chat.'
            : 'Conversas dos moradores. Atenda em ordem de chegada.'
        }
        actions={
          isMorador && !showNova ? (
            <Button onClick={() => setShowNova(true)}>+ Nova conversa</Button>
          ) : isStaff && !showStaffNova ? (
            <Button onClick={() => setShowStaffNova(true)}>+ Nova conversa</Button>
          ) : null
        }
      />

      {/* Nova conversa (staff inicia) */}
      {isStaff && showStaffNova && (
        <form
          onSubmit={handleStaffEnviar}
          className="mb-6 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5 space-y-4"
        >
          <div className="text-sm font-medium text-sky-200">Enviar mensagem</div>

          <Field label="Destino">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDestinoTipo('pessoa')}
                className={`px-3 py-1.5 rounded-md text-sm border transition ${
                  destinoTipo === 'pessoa'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                    : 'border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                Pessoa específica
              </button>
              <button
                type="button"
                onClick={() => setDestinoTipo('unidade')}
                className={`px-3 py-1.5 rounded-md text-sm border transition ${
                  destinoTipo === 'unidade'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                    : 'border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                Unidade (todos os proprietários)
              </button>
            </div>
          </Field>

          {destinoTipo === 'pessoa' ? (
            <Field label={`Proprietário (${proprietarios.length} com acesso)`}>
              <div ref={comboRef} className="relative">
                <input
                  type="text"
                  value={
                    pessoaSelecionada && !comboAberto
                      ? `${pessoaSelecionada.nome} — un. ${
                          (pessoaSelecionada as unknown as { unidade_label?: string }).unidade_label ?? '—'
                        }`
                      : buscaPessoa
                  }
                  onChange={(e) => {
                    setBuscaPessoa(e.target.value)
                    setComboAberto(true)
                    if (pessoaSelecionada) setPessoaSelecionada(null)
                  }}
                  onFocus={() => setComboAberto(true)}
                  placeholder="Digite o nome ou número da unidade..."
                  className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-sky-500 focus:outline-none"
                />
                {comboAberto && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
                    {proprietariosFiltrados.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500">
                        {proprietarios.length === 0
                          ? 'Nenhum proprietário cadastrado com acesso ao app.'
                          : 'Sem resultados pra essa busca.'}
                      </div>
                    ) : (
                      proprietariosFiltrados.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPessoaSelecionada(p)
                            setBuscaPessoa('')
                            setComboAberto(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-800 transition flex items-center justify-between gap-3"
                        >
                          <span className="text-sm text-slate-100 truncate">{p.nome}</span>
                          <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">
                            un. {p.unidade_label}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </Field>
          ) : (
            <Field label="Unidade">
              <Select
                value={unidadeSelecionada}
                onChange={(e) => setUnidadeSelecionada(e.target.value)}
              >
                <option value="">Selecione...</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.bloco ? `${u.bloco}-${u.numero}` : u.numero}
                  </option>
                ))}
              </Select>
              <div className="mt-1 text-xs text-slate-500">
                Manda mensagem só pros proprietários cadastrados que já tenham acesso ao app.
              </div>
            </Field>
          )}

          <Field label="Sobre o quê?" required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(ASSUNTO_LABEL) as AssuntoConversa[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setStaffAssunto(a)}
                  className={`px-3 py-2 rounded-md text-sm border text-left transition ${
                    staffAssunto === a
                      ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {ASSUNTO_LABEL[a]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Mensagem" required>
            <TextArea
              required
              rows={4}
              value={staffMsg}
              onChange={(e) => setStaffMsg(e.target.value)}
              placeholder="Escreva a mensagem que será enviada. O Agente pode polir o texto antes."
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={melhorarComAgente}
                disabled={polindo || !staffMsg.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-violet-700/20 text-violet-200 border border-violet-500/40 hover:bg-violet-700/30 disabled:opacity-50 transition"
              >
                {polindo ? '✨ Pensando...' : '✨ Melhorar com o Agente'}
              </button>
              <span className="text-[11px] text-slate-500">
                Reescreve seu esboço no tom do chat, mantendo o objetivo.
              </span>
            </div>
          </Field>

          {staffError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {staffError}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={criando}>
              {criando ? 'Enviando...' : 'Enviar mensagem'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowStaffNova(false)
                setStaffMsg('')
                setUnidadeSelecionada('')
                setPessoaSelecionada(null)
                setBuscaPessoa('')
                setStaffError(null)
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Nova conversa (só morador) */}
      {isMorador && showNova && (
        <form
          onSubmit={handleCriar}
          className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4"
        >
          <div className="text-sm font-medium text-emerald-200">Nova conversa</div>
          <Field label="Sobre o quê?" required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(ASSUNTO_LABEL) as AssuntoConversa[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setNovaAssunto(a)}
                  className={`px-3 py-2 rounded-md text-sm border text-left transition ${
                    novaAssunto === a
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {ASSUNTO_LABEL[a]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Mensagem" required>
            <TextArea
              required
              rows={4}
              value={novaMsg}
              onChange={(e) => setNovaMsg(e.target.value)}
              placeholder="Escreva sua mensagem. A administração será notificada."
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={criando}>
              {criando ? 'Abrindo...' : 'Enviar'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowNova(false)
                setNovaMsg('')
              }}
            >
              Cancelar
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Limite: 3 conversas abertas por vez. Encerre uma se quiser abrir outra.
          </p>
        </form>
      )}

      {/* Filtros pra staff */}
      {isStaff && (
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          {isAdmin && condos.length > 0 && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
              <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
                {condos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | StatusConversa)}
            >
              <option value="">Todos</option>
              <option value="aguardando_humano">⚠ Aguardando atendimento</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="aberta">Aberta</option>
              <option value="encerrada">Encerrada</option>
            </Select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-medium text-slate-400 mb-1">Buscar morador ou assunto</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do morador ou assunto..."
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <CardListSkeleton rows={4} />
      ) : rowsFiltradas.length === 0 ? (
        <EmptyState
          message={rows.length === 0 ? 'Nenhuma conversa.' : 'Nenhuma conversa bate com a busca.'}
          action={
            isMorador && !showNova && rows.length === 0 ? (
              <button onClick={() => setShowNova(true)} className="text-emerald-400 hover:underline text-sm">
                Abrir a primeira →
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {rowsFiltradas.map((c) => {
            const moradorNome = nomesMorador[c.morador_user_id]
            const assignee = c.atribuida_para ? assigneeNomes[c.atribuida_para] : null
            const unread = naoLidas[c.id] ?? 0
            return (
              <Link
                key={c.id}
                to={`/chat/${c.id}`}
                className={`block rounded-lg border p-4 transition ${
                  unread > 0
                    ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 flex items-center gap-2">
                      <span className={unread > 0 ? 'font-semibold' : ''}>{ASSUNTO_LABEL[c.assunto]}</span>
                      {unread > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-emerald-500 text-white">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                      {isStaff && moradorNome && <span className="text-slate-400 font-normal"> · {moradorNome}</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-2">
                      <span>Última msg: {c.ultima_mensagem_at ? new Date(c.ultima_mensagem_at).toLocaleString('pt-BR') : '-'}</span>
                      {assignee && (
                        <span className="text-violet-300">👤 {assignee}</span>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

