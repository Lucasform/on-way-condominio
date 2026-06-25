import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listVeiculos, setVeiculoAtivo } from '../lib/veiculos'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Veiculo } from '../types/veiculo'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'
import VeiculosImport from '../components/VeiculosImport'

export default function Veiculos() {
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [sortKey, setSortKey] = useState('placa')
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

  useEffect(() => {
    listUnidades().then(setUnidades).catch(() => {})
  }, [])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listVeiculos({
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

  async function handleToggleAtivo(row: Veiculo) {
    const novoEstado = !row.ativo
    const ok = await confirm({
      message: `${novoEstado ? 'Reativar' : 'Desativar'} veículo "${row.placa}"?`,
      tone: novoEstado ? 'primary' : 'danger',
      confirmText: novoEstado ? 'Reativar' : 'Desativar',
    })
    if (!ok) return
    try {
      await setVeiculoAtivo(row.id, novoEstado)
      await reload()
      toast.success(novoEstado ? 'Veículo reativado.' : 'Veículo desativado.')
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '')
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const unidadeLabel = (uid: string) => {
    const u = unidades.find((x) => x.id === uid)
    if (!u) return '—'
    return u.bloco ? `${u.bloco}-${u.numero}` : u.numero
  }

  const rowsFiltrados = (() => {
    let base = [...rows]
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      base = base.filter((r) =>
        r.placa.toLowerCase().includes(q) ||
        (r.modelo ?? '').toLowerCase().includes(q),
      )
    }
    if (filtroTipo) base = base.filter((r) => r.tipo === filtroTipo)
    base.sort((a, b) => {
      let va = ''
      let vb = ''
      if (sortKey === 'placa') { va = a.placa; vb = b.placa }
      else if (sortKey === 'modelo') { va = a.modelo ?? ''; vb = b.modelo ?? '' }
      else if (sortKey === 'tipo') { va = a.tipo; vb = b.tipo }
      else if (sortKey === 'unidade') { va = unidadeLabel(a.unidade_id); vb = unidadeLabel(b.unidade_id) }
      return sortDir === 'asc' ? va.localeCompare(vb, 'pt') : vb.localeCompare(va, 'pt')
    })
    return base
  })()

  const columns: Column<Veiculo>[] = [
    { key: 'placa', header: 'Placa', sortable: true, nowrap: true, render: (r) => <span className="font-mono font-medium text-slate-100">{r.placa}</span> },
    { key: 'modelo', header: 'Modelo', sortable: true, render: (r) => r.modelo ?? '—' },
    { key: 'cor', header: 'Cor', render: (r) => r.cor ?? '—' },
    { key: 'tipo', header: 'Tipo', sortable: true, render: (r) => <span className="capitalize">{r.tipo}</span> },
    { key: 'unidade', header: 'Unidade', sortable: true, nowrap: true, render: (r) => unidadeLabel(r.unidade_id) },
    { key: 'vaga', header: 'Vaga', render: (r) => r.vaga ?? '—' },
    {
      key: 'ativo',
      header: 'Status',
      render: (r) =>
        r.ativo ? (
          <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">Ativo</span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs bg-slate-700/40 text-slate-400">Inativo</span>
        ),
    },
  ]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Veículos (${rowsFiltrados.length}${rowsFiltrados.length !== rows.length ? ` de ${rows.length}` : ''})`}
        subtitle="Carros, motos e demais veículos das unidades."
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
            <Link to="/veiculos/novo">
              <Button>+ Novo veículo</Button>
            </Link>
          </>
        }
      />

      {showImport && isGestor(perfil?.role) && (perfil?.condominio_id || (isAdmin && scopeId)) && (
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Importar veículos em massa</h2>
          <VeiculosImport condominio_id={(perfil?.condominio_id ?? scopeId) as string} />
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
          placeholder="Buscar por placa ou modelo..."
          className="flex-1 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Todos os tipos</option>
          <option value="carro">Carro</option>
          <option value="moto">Moto</option>
          <option value="caminhonete">Caminhonete</option>
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
        onRowClick={(r) => navigate(`/veiculos/${r.id}`)}
        emptyMessage="Nenhum veículo encontrado."
        actions={(r) => (
          <div className="flex gap-1 justify-end">
            <Link to={`/veiculos/${r.id}`}>
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
