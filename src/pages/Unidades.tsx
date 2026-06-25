import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listUnidades, setUnidadeAtivo } from '../lib/unidades'
import { listCondominios } from '../lib/condominios'
import type { Unidade } from '../types/unidade'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'
import UnidadesImport from '../components/UnidadesImport'

export default function Unidades() {
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [sortKey, setSortKey] = useState('identificador')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    listCondominios()
      .then((cs) => {
        setCondos(cs)
        if (isAdmin && cs.length && !scopeId) setScopeId(cs[0].id)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listUnidades({
        condominio_id: isAdmin && scopeId ? scopeId : undefined,
        ativo: showInactive ? undefined : true,
      })
      setRows(data)
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

  async function handleToggleAtivo(row: Unidade) {
    const novoEstado = !row.ativo
    const label = `${row.bloco ? row.bloco + '-' : ''}${row.numero}`
    const ok = await confirm({
      message: `${novoEstado ? 'Reativar' : 'Desativar'} unidade "${label}"?`,
      tone: novoEstado ? 'primary' : 'danger',
      confirmText: novoEstado ? 'Reativar' : 'Desativar',
    })
    if (!ok) return
    try {
      await setUnidadeAtivo(row.id, novoEstado)
      await reload()
      toast.success(novoEstado ? 'Unidade reativada.' : 'Unidade desativada.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const condoNome = (id: string) => condos.find((c) => c.id === id)?.nome ?? '—'

  const rowsFiltrados = (() => {
    let base = [...rows]
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      base = base.filter((r) =>
        r.numero.toLowerCase().includes(q) ||
        (r.bloco ?? '').toLowerCase().includes(q),
      )
    }
    if (filtroTipo) base = base.filter((r) => r.tipo === filtroTipo)
    base.sort((a, b) => {
      if (sortKey === 'area_m2') {
        return sortDir === 'asc' ? (a.area_m2 ?? 0) - (b.area_m2 ?? 0) : (b.area_m2 ?? 0) - (a.area_m2 ?? 0)
      }
      let va = ''
      let vb = ''
      if (sortKey === 'identificador') { va = `${a.bloco ?? ''}-${a.numero}`; vb = `${b.bloco ?? ''}-${b.numero}` }
      else if (sortKey === 'tipo') { va = a.tipo; vb = b.tipo }
      return sortDir === 'asc' ? va.localeCompare(vb, 'pt') : vb.localeCompare(va, 'pt')
    })
    return base
  })()

  const columns: Column<Unidade>[] = [
    {
      key: 'identificador',
      header: 'Identificação',
      sortable: true,
      nowrap: true,
      render: (r) => (
        <span className="font-medium text-slate-100">
          {r.bloco ? `${r.bloco} · ${r.numero}` : r.numero}
        </span>
      ),
    },
    { key: 'tipo', header: 'Tipo', sortable: true, render: (r) => <span className="capitalize">{r.tipo}</span> },
    { key: 'area_m2', header: 'Área', sortable: true, nowrap: true, render: (r) => (r.area_m2 ? `${r.area_m2} m²` : '—') },
  ]
  if (isAdmin) {
    columns.push({ key: 'condo', header: 'Condomínio', render: (r) => condoNome(r.condominio_id) })
  }
  columns.push({
    key: 'ativo',
    header: 'Status',
    render: (r) =>
      r.ativo ? (
        <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">Ativo</span>
      ) : (
        <span className="px-2 py-0.5 rounded text-xs bg-slate-700/40 text-slate-400">Inativo</span>
      ),
  })

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Unidades (${rowsFiltrados.length}${rowsFiltrados.length !== rows.length ? ` de ${rows.length}` : ''})`}
        subtitle="Apartamentos, casas, salas e lojas do condomínio."
        actions={
          <>
            {isGestor(perfil?.role) && (
              <Button variant="secondary" onClick={() => setShowImport((v) => !v)}>
                {showImport ? '✕ Fechar importação' : '⬆ Importar'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </Button>
            <Link to="/unidades/novo">
              <Button>+ Nova unidade</Button>
            </Link>
          </>
        }
      />

      {showImport && isGestor(perfil?.role) && (perfil?.condominio_id || (isAdmin && scopeId)) && (
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Importar unidades em massa</h2>
          <UnidadesImport condominio_id={(perfil?.condominio_id ?? scopeId) as string} />
        </div>
      )}

      {isAdmin && condos.length > 0 && (
        <div className="mb-4 max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Filtrar por condomínio</label>
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

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número ou bloco..."
          className="flex-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Todos os tipos</option>
          <option value="apartamento">Apartamento</option>
          <option value="casa">Casa</option>
          <option value="sala">Sala</option>
          <option value="loja">Loja</option>
          <option value="outro">Outro</option>
        </select>
        {(busca || filtroTipo) && (
          <button
            type="button"
            onClick={() => { setBusca(''); setFiltroTipo('') }}
            className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition"
          >
            Limpar
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rowsFiltrados}
        rowKey={(r) => r.id}
        loading={loading}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onRowClick={(r) => navigate(`/unidades/${r.id}`)}
        emptyMessage="Nenhuma unidade encontrada."
        actions={(r) => (
          <div className="flex gap-1 justify-end">
            <Link to={`/unidades/${r.id}/historico`}>
              <Button variant="ghost">Histórico</Button>
            </Link>
            <Link to={`/unidades/${r.id}`}>
              <Button variant="ghost">Editar</Button>
            </Link>
            <Button variant={r.ativo ? 'danger' : 'secondary'} onClick={() => handleToggleAtivo(r)}>
              {r.ativo ? 'Desativar' : 'Reativar'}
            </Button>
          </div>
        )}
      />
    </div>
  )
}
