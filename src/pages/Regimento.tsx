import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  listRegimentoArtigos,
  setRegimentoArtigoAtivo,
  deleteRegimentoArtigo,
  deleteRegimentoArtigosInativos,
} from '../lib/regimento'
import { regenerateEmbedding } from '../lib/iaAnalysis'
import { listCondominios } from '../lib/condominios'
import type { RegimentoArtigo } from '../types/regimento'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

export default function Regimento() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<RegimentoArtigo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

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
      const data = await listRegimentoArtigos({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        ativo: showInactive ? undefined : true,
      })
      setRows(data)
      // Auto-regenera embedding em background pra artigos antigos que ficaram sem
      const pendentes = data.filter((a) => a.ativo && !a.embedding_atualizado_em)
      for (const p of pendentes) {
        const texto = `${p.titulo}\n\n${p.conteudo}`
        regenerateEmbedding(p.id, texto).catch((err) => {
          console.warn('[regimento] falha em regenerar embedding:', err)
        })
      }
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
  }, [scopeId, showInactive])

  async function handleToggleAtivo(row: RegimentoArtigo) {
    const novoEstado = !row.ativo
    const label = `${row.numero ?? ''} ${row.titulo}`.trim()
    if (!window.confirm(`${novoEstado ? 'Reativar' : 'Desativar'} "${label}"?`)) return
    try {
      await setRegimentoArtigoAtivo(row.id, novoEstado)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function handleDeleteArtigo(row: RegimentoArtigo) {
    const label = `${row.numero ?? ''} ${row.titulo}`.trim()
    if (!window.confirm(`Apagar definitivamente "${label}"? Esta acao nao pode ser desfeita.`)) return
    try {
      await deleteRegimentoArtigo(row.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function handleDeleteInativos() {
    const inativos = rows.filter((r) => !r.ativo).length
    if (inativos === 0) {
      alert('Nao ha artigos desativados pra apagar.')
      return
    }
    if (!window.confirm(`Apagar definitivamente ${inativos} artigo${inativos > 1 ? 's' : ''} desativado${inativos > 1 ? 's' : ''}? Esta acao nao pode ser desfeita.`)) return
    try {
      const apagados = await deleteRegimentoArtigosInativos(
        isAdmin && scopeId ? scopeId : undefined,
      )
      await reload()
      alert(`${apagados} artigo${apagados !== 1 ? 's' : ''} apagado${apagados !== 1 ? 's' : ''}.`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  const canEdit = perfil && ['admin_onway', 'administradora', 'sindico'].includes(perfil.role)
  const canDelete = perfil && ['admin_onway', 'sindico'].includes(perfil.role)
  const temInativos = rows.some((r) => !r.ativo)

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <PageHeader
        title={`Regimento interno${rows.length > 0 ? ` (${rows.length} artigos)` : ''}`}
        subtitle="Artigos do regimento usados como base para análise de ocorrências pela IA."
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setShowInactive((v) => !v)}>
                {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
              </Button>
              {canDelete && showInactive && temInativos && (
                <Button variant="danger" onClick={handleDeleteInativos}>
                  Apagar inativos
                </Button>
              )}
              <Link to="/regimento/novo">
                <Button>+ Novo artigo</Button>
              </Link>
            </>
          )
        }
      />

      {isAdmin && condos.length > 0 && (
        <div className="mb-4 max-w-xs">
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
          Nenhum artigo cadastrado.
          {canEdit && (
            <div className="mt-2">
              <Link to="/regimento/novo" className="text-emerald-400 hover:underline">
                Cadastrar o primeiro →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((art) => (
            <article
              key={art.id}
              onClick={() => canEdit && navigate(`/regimento/${art.id}`)}
              className={`rounded-lg border border-slate-800 bg-slate-900/40 p-5 ${
                canEdit ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-900/70' : ''
              } transition`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    {art.numero && (
                      <span className="text-xs font-mono uppercase tracking-wide text-slate-500">
                        {art.numero}
                      </span>
                    )}
                    {!art.ativo && (
                      <span className="text-xs text-slate-500">(inativo)</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">{art.titulo}</h3>
                  <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">
                    {art.conteudo}
                  </p>
                  <div className="mt-3 text-xs text-slate-600">
                    {art.embedding_atualizado_em ? (
                      <span className="text-emerald-500">
                        ✓ IA indexou em {new Date(art.embedding_atualizado_em).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">
                        IA indexando em background...
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/regimento/${art.id}`}>
                      <Button variant="ghost">Editar</Button>
                    </Link>
                    <Button
                      variant={art.ativo ? 'danger' : 'secondary'}
                      onClick={() => handleToggleAtivo(art)}
                    >
                      {art.ativo ? 'Desativar' : 'Reativar'}
                    </Button>
                    {canDelete && !art.ativo && (
                      <button
                        type="button"
                        onClick={() => handleDeleteArtigo(art)}
                        title="Apagar definitivamente"
                        className="p-2 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                        aria-label="Apagar"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
