import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listConversas, createConversa, ASSUNTO_LABEL, STATUS_LABEL } from '../lib/chat'
import type { AssuntoConversa, Conversa, StatusConversa } from '../types/chat'
import { listCondominios } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextArea, Select } from '../components/ui/Input'

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

  // Form de nova conversa (morador)
  const [showNova, setShowNova] = useState(false)
  const [novaAssunto, setNovaAssunto] = useState<AssuntoConversa>('outro')
  const [novaMsg, setNovaMsg] = useState('')
  const [criando, setCriando] = useState(false)

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
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        title={isMorador ? 'Minhas conversas' : 'Conversas do condomínio'}
        subtitle={
          isMorador
            ? 'Fale com a administração. Resposta direta no chat.'
            : 'Conversas dos moradores. Atenda em ordem de chegada.'
        }
        actions={
          isMorador &&
          !showNova && (
            <Button onClick={() => setShowNova(true)}>+ Nova conversa</Button>
          )
        }
      />

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
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-sm">
          Nenhuma conversa.
          {isMorador && !showNova && (
            <div className="mt-2">
              <button
                onClick={() => setShowNova(true)}
                className="text-emerald-400 hover:underline"
              >
                Abrir a primeira →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              to={`/chat/${c.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-100">{ASSUNTO_LABEL[c.assunto]}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Última msg: {c.ultima_mensagem_at ? new Date(c.ultima_mensagem_at).toLocaleString('pt-BR') : '—'}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
