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
} from '../lib/mural'
import { listCondominios } from '../lib/condominios'
import type { Publicacao, Reacao } from '../types/mural'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

export default function Mural() {
  const { user, perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const canPost = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)
  const canModerate = canPost

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Publicacao[]>([])
  const [reacoesByPub, setReacoesByPub] = useState<Map<string, Reacao[]>>(new Map())
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
      // Carrega reações de todas as publicações
      const reacs = await listReacoes(pubs.map((p) => p.id))
      const map = new Map<string, Reacao[]>()
      for (const r of reacs) {
        const list = map.get(r.publicacao_id) ?? []
        list.push(r)
        map.set(r.publicacao_id, list)
      }
      setReacoesByPub(map)
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
      alert(e instanceof Error ? e.message : 'Erro ao reagir.')
    }
  }

  async function handleDelete(pub: Publicacao) {
    if (!window.confirm('Remover esta publicação? Ela será arquivada.')) return
    try {
      await deletePublicacao(pub.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function handleReativar(pub: Publicacao) {
    if (!window.confirm('Reativar esta publicação? Ela volta a aparecer no mural pros moradores.')) return
    try {
      await reativarPublicacao(pub.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function handleApagarDefinitivo(pub: Publicacao) {
    if (!window.confirm('Apagar DEFINITIVAMENTE esta publicação? Esta ação não pode ser desfeita.')) return
    try {
      await apagarPublicacaoDefinitivo(pub.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-sm">
          Nenhuma publicação no mural ainda.
          {canPost && (
            <div className="mt-2">
              <Link to="/mural/novo" className="text-emerald-400 hover:underline">
                Publicar a primeira →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((pub) => {
            const reacoes = reacoesByPub.get(pub.id) ?? []
            // mantem retrocompat: legacy 'curtir' conta como like
            const likes = reacoes.filter((r) => r.tipo === 'like' || r.tipo === 'curtir' || r.tipo === 'amei' || r.tipo === 'aplaudir')
            const dislikes = reacoes.filter((r) => r.tipo === 'dislike')
            const meuLike = user ? likes.some((r) => r.user_id === user.id) : false
            const meuDislike = user ? dislikes.some((r) => r.user_id === user.id) : false
            return (
              <article
                key={pub.id}
                className={`rounded-lg border bg-slate-900/40 overflow-hidden ${
                  !pub.ativo
                    ? 'border-slate-800 opacity-60'
                    : pub.fixado ? 'border-amber-500/40' : 'border-slate-800'
                }`}
              >
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
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
