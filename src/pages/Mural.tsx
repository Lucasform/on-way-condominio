import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listPublicacoes,
  listReacoes,
  adicionarReacao,
  removerReacao,
  getMuralImagemSignedUrl,
  deletePublicacao,
  reativarPublicacao,
  apagarPublicacaoDefinitivo,
  setPublicacaoFixado,
  listComentarios,
  createComentario,
  deleteComentario,
  listMinhasLeituras,
  marcarPublicacaoLida,
  listVotosEnquete,
  votarEnquete,
} from '../lib/mural'
import { listCondominios } from '../lib/condominios'
import type { Publicacao, Reacao, ComentarioPublicacao, PublicacaoVoto } from '../types/mural'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

export default function Mural() {
  const { user, perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const canPost = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)
  const canModerate = canPost

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Publicacao[]>([])
  const [reacoesByPub, setReacoesByPub] = useState<Map<string, Reacao[]>>(new Map())
  const [comentsByPub, setComentsByPub] = useState<Map<string, ComentarioPublicacao[]>>(new Map())
  const [votosByPub, setVotosByPub] = useState<Map<string, PublicacaoVoto[]>>(new Map())
  const [lidasIds, setLidasIds] = useState<Set<string>>(new Set())
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const [novoComent, setNovoComent] = useState<Record<string, string>>({})
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)

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
      const pubs = await listPublicacoes({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        apenas_ativas: !(canModerate && mostrarArquivadas),
      })
      setRows(pubs)
      // Carrega reacoes, comentarios e leituras em paralelo.
      // Comentarios e leituras dependem das migrations 0061 — se ainda nao
      // foram aplicadas, falham silenciosamente sem derrubar o mural.
      const pubIds = pubs.map((p) => p.id)
      const [reacs, coments, leituras, votos] = await Promise.all([
        listReacoes(pubIds),
        listComentarios(pubIds).catch(() => [] as ComentarioPublicacao[]),
        user
          ? listMinhasLeituras(user.id).catch(() => [])
          : Promise.resolve([]),
        listVotosEnquete(pubIds).catch(() => [] as PublicacaoVoto[]),
      ])
      const map = new Map<string, Reacao[]>()
      for (const r of reacs) {
        const list = map.get(r.publicacao_id) ?? []
        list.push(r)
        map.set(r.publicacao_id, list)
      }
      setReacoesByPub(map)
      const cmap = new Map<string, ComentarioPublicacao[]>()
      for (const c of coments) {
        const list = cmap.get(c.publicacao_id) ?? []
        list.push(c)
        cmap.set(c.publicacao_id, list)
      }
      setComentsByPub(cmap)
      const vmap = new Map<string, PublicacaoVoto[]>()
      for (const v of votos) {
        const list = vmap.get(v.publicacao_id) ?? []
        list.push(v)
        vmap.set(v.publicacao_id, list)
      }
      setVotosByPub(vmap)
      setLidasIds(new Set(leituras.map((l) => l.publicacao_id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, mostrarArquivadas])

  // Carrega thumbs sob demanda
  useEffect(() => {
    rows.forEach(async (p) => {
      if (!p.imagem_url || thumbs[p.id]) return
      const url = await getMuralImagemSignedUrl(p.imagem_url, 3600)
      if (url) setThumbs((prev) => ({ ...prev, [p.id]: url }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  async function handleToggleReacao(pub: Publicacao, tipo: 'like' | 'dislike') {
    if (!user) return
    const reacoes = reacoesByPub.get(pub.id) ?? []
    const minhaDesseTipo = reacoes.find((r) => r.user_id === user.id && r.tipo === tipo)
    const oposto: 'like' | 'dislike' = tipo === 'like' ? 'dislike' : 'like'
    const minhaDoOposto = reacoes.find((r) => r.user_id === user.id && r.tipo === oposto)
    try {
      // se ja tinha o mesmo tipo, remove (toggle off)
      if (minhaDesseTipo) {
        await removerReacao(pub.id, user.id, tipo)
      } else {
        // remove o oposto se existir (exclusao mutua) e adiciona o novo
        if (minhaDoOposto) await removerReacao(pub.id, user.id, oposto)
        await adicionarReacao(pub.id, user.id, tipo)
      }
      await reload()
    } catch (e) {
      toast.error('Erro ao reagir', e instanceof Error ? e.message : '')
    }
  }

  async function handleDelete(pub: Publicacao) {
    const ok = await confirm({ message: 'Remover esta publicação? Ela será arquivada.', tone: 'danger', confirmText: 'Remover' })
    if (!ok) return
    try {
      await deletePublicacao(pub.id)
      await reload()
      toast.success('Publicação arquivada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  async function handleToggleFixado(pub: Publicacao) {
    try {
      await setPublicacaoFixado(pub.id, !pub.fixado)
      await reload()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  async function handleReativar(pub: Publicacao) {
    const ok = await confirm({ message: 'Reativar esta publicação? Ela volta a aparecer no mural pros moradores.' })
    if (!ok) return
    try {
      await reativarPublicacao(pub.id)
      await reload()
      toast.success('Publicação reativada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  async function handleApagarDefinitivo(pub: Publicacao) {
    const ok = await confirm({
      title: 'Apagar publicação',
      message: 'Apagar DEFINITIVAMENTE esta publicação? Esta ação não pode ser desfeita.',
      tone: 'danger',
      confirmText: 'Apagar',
    })
    if (!ok) return
    try {
      await apagarPublicacaoDefinitivo(pub.id)
      await reload()
      toast.success('Publicação apagada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  async function handleToggleExpandida(pub: Publicacao) {
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(pub.id)) next.delete(pub.id)
      else next.add(pub.id)
      return next
    })
    // Marca como lida ao abrir
    if (user && !lidasIds.has(pub.id)) {
      try {
        await marcarPublicacaoLida(pub.id, user.id)
        setLidasIds((prev) => new Set(prev).add(pub.id))
      } catch (e) {
        console.warn('Erro ao marcar lida:', e)
      }
    }
  }

  async function handleComentar(pub: Publicacao) {
    if (!user) return
    const texto = (novoComent[pub.id] ?? '').trim()
    if (!texto) return
    try {
      const c = await createComentario(pub.id, user.id, texto)
      setComentsByPub((prev) => {
        const next = new Map(prev)
        const list = next.get(pub.id) ?? []
        next.set(pub.id, [...list, c])
        return next
      })
      setNovoComent((prev) => ({ ...prev, [pub.id]: '' }))
    } catch (e) {
      toast.error('Erro ao comentar', e instanceof Error ? e.message : '')
    }
  }

  async function handleVotar(pub: Publicacao, idx: number) {
    if (!user) return
    try {
      await votarEnquete(pub.id, user.id, idx)
      // Atualiza local sem reload completo
      setVotosByPub((prev) => {
        const next = new Map(prev)
        const lista = (next.get(pub.id) ?? []).filter((v) => v.user_id !== user.id)
        lista.push({
          publicacao_id: pub.id,
          user_id: user.id,
          opcao_idx: idx,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        next.set(pub.id, lista)
        return next
      })
    } catch (e) {
      toast.error('Erro ao votar', e instanceof Error ? e.message : '')
    }
  }

  async function handleApagarComentario(pub: Publicacao, c: ComentarioPublicacao) {
    const ok = await confirm({ message: 'Apagar este comentário?', tone: 'danger', confirmText: 'Apagar' })
    if (!ok) return
    try {
      await deleteComentario(c.id)
      setComentsByPub((prev) => {
        const next = new Map(prev)
        const list = (next.get(pub.id) ?? []).filter((x) => x.id !== c.id)
        next.set(pub.id, list)
        return next
      })
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  const isAdminGeral = perfil?.role === 'admin_onway'

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-2xl mx-auto">
      <PageHeader
        title="Mural"
        subtitle="Publicações da administração e comunicados do condomínio."
        actions={
          canPost && (
            <div className="flex items-center gap-2">
              {canModerate && (
                <Button
                  variant="secondary"
                  onClick={() => setMostrarArquivadas((v) => !v)}
                >
                  {mostrarArquivadas ? 'Ocultar arquivadas' : 'Mostrar arquivadas'}
                </Button>
              )}
              <Link to="/mural/novo">
                <Button>+ Nova publicação</Button>
              </Link>
            </div>
          )
        }
      />

      {isAdmin && condos.length > 0 && (
        <div className="mb-5 max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
          <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
            {condos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          message="Nenhuma publicação no mural ainda."
          action={
            canPost ? (
              <Link to="/mural/novo" className="text-emerald-400 hover:underline text-sm">
                Publicar a primeira →
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {rows.map((pub) => {
            const reacoes = reacoesByPub.get(pub.id) ?? []
            // mantem retrocompat: legacy 'curtir' conta como like
            const likes = reacoes.filter((r) => r.tipo === 'like' || r.tipo === 'curtir' || r.tipo === 'amei' || r.tipo === 'aplaudir')
            const dislikes = reacoes.filter((r) => r.tipo === 'dislike')
            const meuLike = user ? likes.some((r) => r.user_id === user.id) : false
            const meuDislike = user ? dislikes.some((r) => r.user_id === user.id) : false
            const naoLida = !!user && pub.ativo && !lidasIds.has(pub.id)
            const coments = comentsByPub.get(pub.id) ?? []
            const expandida = expandidas.has(pub.id)
            return (
              <article
                key={pub.id}
                className={`rounded-lg border bg-slate-900/40 overflow-hidden ${
                  !pub.ativo
                    ? 'border-slate-800 opacity-60'
                    : naoLida ? 'border-brand-500/60 ring-1 ring-brand-500/20'
                    : pub.fixado ? 'border-amber-500/40' : 'border-slate-800'
                }`}
              >
                {naoLida && (
                  <div className="bg-brand-500/10 text-brand-300 text-xs px-4 py-1.5 border-b border-brand-500/30 flex items-center gap-1">
                    ✨ Novo · ainda não lido
                  </div>
                )}
                {!pub.ativo && (
                  <div className="bg-slate-800/60 text-slate-400 text-xs px-4 py-1.5 border-b border-slate-700 flex items-center gap-1">
                    🗄 Arquivada
                  </div>
                )}
                {pub.ativo && pub.fixado && (
                  <div className="bg-amber-500/10 text-amber-300 text-xs px-4 py-1.5 border-b border-amber-500/30 flex items-center gap-1">
                    📌 Fixado
                  </div>
                )}
                {pub.ativo && pub.expira_em && (
                  <div className="bg-purple-500/10 text-purple-300 text-xs px-4 py-1.5 border-b border-purple-500/30 flex items-center gap-1">
                    ⏱ Story · expira {formatExpira(pub.expira_em)}
                  </div>
                )}

                {thumbs[pub.id] && (
                  <a href={thumbs[pub.id]} target="_blank" rel="noreferrer">
                    <img
                      src={thumbs[pub.id]}
                      alt=""
                      className="w-full max-h-96 object-cover hover:opacity-95 transition"
                    />
                  </a>
                )}

                <div className="p-5">
                  {pub.titulo && (
                    <h3 className="text-lg font-semibold text-slate-100 mb-2">{pub.titulo}</h3>
                  )}
                  <p className="text-slate-200 whitespace-pre-wrap">{pub.conteudo}</p>

                  {pub.enquete && (() => {
                    const votos = votosByPub.get(pub.id) ?? []
                    const total = votos.length
                    const meuVoto = user ? votos.find((v) => v.user_id === user.id) : null
                    return (
                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                            📊 Enquete
                          </span>
                          {pub.enquete.pergunta && (
                            <span className="text-sm text-slate-200">{pub.enquete.pergunta}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {pub.enquete.opcoes.map((opt, idx) => {
                            const count = votos.filter((v) => v.opcao_idx === idx).length
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0
                            const escolhida = meuVoto?.opcao_idx === idx
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleVotar(pub, idx)}
                                disabled={!user}
                                className={`relative w-full text-left rounded-md border overflow-hidden transition ${
                                  escolhida
                                    ? 'border-brand-500 bg-brand-700/20'
                                    : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                                }`}
                              >
                                <div
                                  className={`absolute inset-y-0 left-0 ${
                                    escolhida ? 'bg-brand-700/30' : 'bg-slate-700/30'
                                  }`}
                                  style={{ width: `${pct}%`, transition: 'width 250ms' }}
                                />
                                <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                                  <span className="text-slate-100">
                                    {escolhida && '✓ '}{opt}
                                  </span>
                                  <span className="text-xs text-slate-300">
                                    {pct}% <span className="text-slate-500">({count})</span>
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-1.5 text-xs text-slate-500">
                          {total} {total === 1 ? 'voto' : 'votos'}
                          {!user && ' · entre pra votar'}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-4 text-sm">
                    <button
                      onClick={() => handleToggleReacao(pub, 'like')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
                        meuLike
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800/60 text-slate-300 border border-slate-700 hover:border-slate-600'
                      }`}
                      title="Like"
                    >
                      <span>👍</span>
                      <span>{likes.length > 0 ? likes.length : 'Like'}</span>
                    </button>

                    <button
                      onClick={() => handleToggleReacao(pub, 'dislike')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
                        meuDislike
                          ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                          : 'bg-slate-800/60 text-slate-300 border border-slate-700 hover:border-slate-600'
                      }`}
                      title="Dislike"
                    >
                      <span>👎</span>
                      <span>{dislikes.length > 0 ? dislikes.length : 'Dislike'}</span>
                    </button>

                    <span className="text-xs text-slate-500 ml-auto">
                      {new Date(pub.created_at).toLocaleString('pt-BR')}
                    </span>

                    {canModerate && pub.ativo && (
                      <button
                        onClick={() => handleToggleFixado(pub)}
                        className={`text-xs transition ${
                          pub.fixado
                            ? 'text-amber-400 hover:text-amber-300'
                            : 'text-slate-500 hover:text-amber-400'
                        }`}
                        title={pub.fixado ? 'Desafixar do topo' : 'Fixar no topo'}
                      >
                        📌
                      </button>
                    )}
                    {canModerate && pub.ativo && (
                      <button
                        onClick={() => handleDelete(pub)}
                        className="text-xs text-slate-500 hover:text-red-400 transition"
                        title="Arquivar publicação"
                      >
                        🗑
                      </button>
                    )}
                    {canModerate && !pub.ativo && (
                      <button
                        onClick={() => handleReativar(pub)}
                        className="text-xs text-slate-500 hover:text-emerald-400 transition"
                        title="Reativar"
                      >
                        ↺ Reativar
                      </button>
                    )}
                    {isAdminGeral && !pub.ativo && (
                      <button
                        onClick={() => handleApagarDefinitivo(pub)}
                        className="text-xs text-red-500/70 hover:text-red-400 transition"
                        title="Apagar definitivo (não pode ser desfeito)"
                      >
                        ✕ Apagar definitivo
                      </button>
                    )}
                  </div>

                  {/* Comentarios */}
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <button
                      onClick={() => handleToggleExpandida(pub)}
                      className="text-xs text-slate-400 hover:text-slate-100 transition"
                    >
                      💬 Comentários ({coments.length}) {expandida ? '▾' : '▸'}
                    </button>
                    {expandida && (
                      <div className="mt-3 space-y-2">
                        {coments.length === 0 ? (
                          <div className="text-xs text-slate-500 italic">Seja o primeiro a comentar.</div>
                        ) : coments.map((c) => (
                          <div key={c.id} className="rounded-md bg-slate-800/40 px-3 py-2 text-sm">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs text-slate-500">
                                {c.user_id === user?.id ? 'você' : `usuário ${c.user_id.slice(0, 6)}…`}
                                {' · '}
                                {new Date(c.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                              {(c.user_id === user?.id || canModerate) && (
                                <button
                                  onClick={() => handleApagarComentario(pub, c)}
                                  className="text-xs text-slate-500 hover:text-red-400"
                                  title="Apagar"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <p className="text-slate-200 whitespace-pre-wrap mt-0.5">{c.conteudo}</p>
                          </div>
                        ))}
                        {user && (
                          <form
                            className="flex gap-2 mt-2"
                            onSubmit={(e) => { e.preventDefault(); handleComentar(pub) }}
                          >
                            <input
                              type="text"
                              value={novoComent[pub.id] ?? ''}
                              onChange={(e) => setNovoComent((prev) => ({ ...prev, [pub.id]: e.target.value }))}
                              placeholder="Escrever um comentário..."
                              maxLength={2000}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-600"
                            />
                            <Button size="sm" type="submit" disabled={!(novoComent[pub.id] ?? '').trim()}>
                              Enviar
                            </Button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatExpira(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'em instantes'
  const horas = Math.floor(ms / 3600_000)
  const minutos = Math.floor((ms % 3600_000) / 60_000)
  if (horas >= 1) return `em ${horas}h${minutos ? ` ${minutos}min` : ''}`
  return `em ${minutos}min`
}
