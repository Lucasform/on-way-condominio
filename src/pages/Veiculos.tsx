import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listVeiculos, setVeiculoAtivo } from '../lib/veiculos'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Veiculo } from '../types/veiculo'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'

export default function Veiculos() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Veiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

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
    if (!window.confirm(`${novoEstado ? 'Reativar' : 'Desativar'} veículo "${row.placa}"?`)) return
    try {
      await setVeiculoAtivo(row.id, novoEstado)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  const unidadeLabel = (uid: string) => {
    const u = unidades.find((x) => x.id === uid)
    if (!u) return '—'
    return u.bloco ? `${u.bloco}-${u.numero}` : u.numero
  }

  const columns: Column<Veiculo>[] = [
    { key: 'placa', header: 'Placa', render: (r) => <span className="font-mono font-medium text-slate-100">{r.placa}</span> },
    { key: 'modelo', header: 'Modelo', render: (r) => r.modelo ?? '—' },
    { key: 'cor', header: 'Cor', render: (r) => r.cor ?? '—' },
    { key: 'tipo', header: 'Tipo', render: (r) => <span className="capitalize">{r.tipo}</span> },
    { key: 'unidade', header: 'Unidade', render: (r) => unidadeLabel(r.unidade_id) },
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
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        title="Veículos"
        subtitle="Carros, motos e demais veículos das unidades."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </Button>
            <Link to="/veiculos/novo">
              <Button>+ Novo veículo</Button>
            </Link>
          </>
        }
      />

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

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={(r) => navigate(`/veiculos/${r.id}`)}
        emptyMessage="Nenhum veículo cadastrado."
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
