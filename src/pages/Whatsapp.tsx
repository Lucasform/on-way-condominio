import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import {
  listWaConversas, getWaThread, sendWaMessage, markWaLida, ensureWaConversa,
  listContatosComTelefone, deleteWaConversa,
  type WaConversa, type WaMensagem, type PessoaContato,
} from '../lib/whatsappInbox'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import TemplatePicker from '../components/TemplatePicker'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'

function horaCurta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Whatsapp() {
  const { perfil, user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string>('')
  const [conversas, setConversas] = useState<WaConversa[]>([])
  const [busca, setBusca] = useState('')
  const [ativa, setAtiva] = useState<WaConversa | null>(null)
  const [thread, setThread] = useState<WaMensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [novaOpen, setNovaOpen] = useState(false)

  const msgsRef = useRef<HTMLDivElement | null>(null)

  // Escopo
  useEffect(() => {
    if (isAdmin) {
      listCondominios().then((cs) => {
        setCondos(cs)
        if (cs.length && !scopeId) setScopeId(cs[0].id)
      }).catch(() => {})
    } else if (perfil?.condominio_id) {
      setScopeId(perfil.condominio_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, perfil])

  // Lista de conversas (polling 5s)
  useEffect(() => {
    if (!scopeId) return
    let alive = true
    const load = () => listWaConversas(scopeId).then((c) => { if (alive) setConversas(c) }).catch(() => {})
    load()
    const t = window.setInterval(load, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [scopeId])

  // Thread da conversa ativa (polling 4s)
  useEffect(() => {
    if (!ativa) { setThread([]); return }
    let alive = true
    const load = () => getWaThread(ativa.id).then((m) => { if (alive) setThread(m) }).catch(() => {})
    load()
    markWaLida(ativa.id).catch(() => {})
    const t = window.setInterval(load, 4000)
    return () => { alive = false; clearInterval(t) }
  }, [ativa])

  useEffect(() => {
    const el = msgsRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return conversas
    return conversas.filter((c) =>
      (c.contato_nome ?? '').toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '')))
  }, [conversas, busca])

  async function handleEnviar() {
    if (!ativa || !texto.trim() || !user) return
    setEnviando(true)
    try {
      const r = await sendWaMessage({ conversa: ativa, texto: texto.trim(), autor_id: user.id })
      if (r.skipped) {
        toast.error('WhatsApp inativo', 'Conecte o WhatsApp do condomínio antes de enviar.')
        return
      }
      if (!r.ok) {
        if (r.reason === 'numero_sem_whatsapp') {
          toast.error('Número sem WhatsApp', 'Este telefone não tem conta no WhatsApp. Confira o número cadastrado.')
        } else {
          toast.error('Falha', r.error || 'Não foi possível enviar.')
        }
        return
      }
      setTexto('')
      const m = await getWaThread(ativa.id)
      setThread(m)
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    } finally {
      setEnviando(false)
    }
  }

  async function handleApagarConversa() {
    if (!ativa) return
    const ok = await confirm({
      title: 'Apagar conversa?',
      message: 'A conversa e todo o histórico dela serão removidos do app. Não desconecta o WhatsApp.',
      tone: 'danger',
      confirmText: 'Apagar',
    })
    if (!ok) return
    try {
      await deleteWaConversa(ativa.id)
      setAtiva(null)
      setConversas((cs) => cs.filter((c) => c.id !== ativa.id))
      toast.success('Conversa apagada')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  async function abrirContato(c: PessoaContato) {
    try {
      const conv = await ensureWaConversa({
        condominio_id: scopeId,
        telefone: c.telefone,
        contato_nome: c.nome,
        pessoa_id: c.id,
        unidade_id: c.unidade_id,
      })
      setNovaOpen(false)
      setBusca('')
      const lista = await listWaConversas(scopeId)
      setConversas(lista)
      setAtiva(lista.find((x) => x.id === conv.id) ?? conv)
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-6xl mx-auto">
      <PageHeader
        title="WhatsApp"
        subtitle="Converse com moradores pelo WhatsApp do condomínio. Histórico salvo aqui."
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setNovaOpen(true)} disabled={!scopeId}>+ Nova conversa</Button>
            <Link to="/whatsapp-config"><Button variant="ghost">⚙ Conexão</Button></Link>
          </div>
        }
      />

      {isAdmin && condos.length > 0 && (
        <div className="mb-4 max-w-xs">
          <select
            value={scopeId}
            onChange={(e) => { setScopeId(e.target.value); setAtiva(null) }}
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm text-slate-100"
          >
            {condos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 rounded-lg border border-slate-800 overflow-hidden h-[70vh]">
        {/* Lista */}
        <div className={`border-r border-slate-800 bg-slate-900/40 flex flex-col ${ativa ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-slate-800">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone…"
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm text-slate-100"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtradas.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">Nenhuma conversa ainda.</div>
            ) : filtradas.map((c) => (
              <button
                key={c.id}
                onClick={() => setAtiva(c)}
                className={`w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 ${ativa?.id === c.id ? 'bg-slate-800/60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-100 truncate">
                    {c.contato_nome || `+${c.telefone}`}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">{horaCurta(c.ultima_mensagem_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 truncate">{c.ultima_mensagem ?? '—'}</span>
                  {c.nao_lidas > 0 && (
                    <span className="shrink-0 text-[10px] bg-emerald-500 text-white rounded-full px-1.5 py-0.5">{c.nao_lidas}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={`bg-slate-950/40 flex flex-col ${ativa ? 'flex' : 'hidden md:flex'}`}>
          {!ativa ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-600">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/40 flex items-center gap-2">
                <button onClick={() => setAtiva(null)} className="md:hidden text-slate-400">←</button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-100">{ativa.contato_nome || `+${ativa.telefone}`}</div>
                  <div className="text-[11px] text-slate-500">+{ativa.telefone}</div>
                </div>
                <button
                  onClick={handleApagarConversa}
                  title="Apagar conversa"
                  className="text-slate-500 hover:text-red-400 text-sm px-2 py-1"
                >
                  🗑
                </button>
              </div>

              <div ref={msgsRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.direcao === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.direcao === 'out' ? 'bg-emerald-700/70 text-white' : 'bg-slate-800 text-slate-100'
                    }`}>
                      {m.conteudo}
                      <div className="text-[10px] opacity-60 mt-1 text-right">{horaCurta(m.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-800 bg-slate-900/40">
                <div className="mb-2">
                  <TemplatePicker
                    condominio_id={scopeId}
                    tipo={['chat', 'whatsapp']}
                    onSelect={(t) => setTexto((prev) => (prev ? `${prev}\n${t.corpo}` : t.corpo))}
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleEnviar() }}
                    rows={2}
                    placeholder="Mensagem… (Ctrl+Enter envia)"
                    className="flex-1 px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm text-slate-100 resize-none"
                  />
                  <Button onClick={handleEnviar} disabled={enviando || !texto.trim()}>
                    {enviando ? '...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {novaOpen && (
        <NovaConversaModal
          condominioId={scopeId}
          onClose={() => setNovaOpen(false)}
          onPick={abrirContato}
        />
      )}
    </div>
  )
}

function NovaConversaModal({
  condominioId, onClose, onPick,
}: { condominioId: string; onClose: () => void; onPick: (c: PessoaContato) => void }) {
  const [contatos, setContatos] = useState<PessoaContato[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listContatosComTelefone(condominioId)
      .then(setContatos)
      .catch(() => setContatos([]))
      .finally(() => setLoading(false))
  }, [condominioId])

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return contatos
    return contatos.filter((c) =>
      c.nome.toLowerCase().includes(s) ||
      (c.unidade_label ?? '').toLowerCase().includes(s) ||
      c.telefone.includes(s.replace(/\D/g, '')))
  }, [contatos, q])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg w-[90vw] max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
          <div className="text-sm font-semibold text-slate-100 flex-1">Nova conversa</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        <div className="p-3 border-b border-slate-800">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pessoa, unidade ou telefone…"
            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm text-slate-100"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-500">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhuma pessoa com telefone cadastrado.
            </div>
          ) : filtrados.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className="w-full text-left px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40"
            >
              <div className="text-sm text-slate-100">{c.nome}</div>
              <div className="text-xs text-slate-500">
                {c.unidade_label ? `Un. ${c.unidade_label} · ` : ''}+{c.telefone.replace(/\D/g, '')}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
