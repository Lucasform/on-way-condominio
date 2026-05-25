import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listUnidades, setUnidadeAtivo } from '../lib/unidades'
import { listCondominios } from '../lib/condominios'
import type { Unidade } from '../types/unidade'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'

export default function Unidades() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway'

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  // Carrega lista de condomínios uma vez (pra montar o filtro do admin
  // e pra exibir nome nas linhas)
  useEffect(() => {
    listCondominios()
      .then((cs) => {
        setCondos(cs)
        if (isAdmin && cs.length && !scopeId) {
          setScopeId(cs[0].id)
        }
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
    if (!window.confirm(`${novoEstado ? 'Reativar' : 'Desativar'} unidade "${label}"?`)) return
    try {
      await setUnidadeAtivo(row.id, novoEstado)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  const condoNome = (id: string) => condos.find((c) => c.id === id)?.nome ?? '—'

  const columns: Column<Unidade>[] = [
    {
      key: 'identificador',
      header: 'Identificação',
      render: (r) => (
        <span className="font-medium text-slate-100">
          {r.bloco ? `${r.bloco} · ${r.numero}` : r.numero}
        </span>
      ),
    },
    { key: 'tipo', header: 'Tipo', render: (r) => <span className="capitalize">{r.tipo}</span> },
    { key: 'area_m2', header: 'Área', render: (r) => (r.area_m2 ? `${r.area_m2} m²` : '—') },
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
    <div className="px-8 py-10 max-w-6xl">
      <PageHeader
        title="Unidades"
        subtitle="Apartamentos, casas, salas e lojas do condomínio."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </Button>
            <Link to="/unidades/novo">
              <Button>+ Nova unidade</Button>
            </Link>
          </>
        }
      />

      {isAdmin && condos.length > 0 && (
        <div className="mb-4 max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Filtrar por condomínio</label>
          <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
            {condos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
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
        onRowClick={(r) => navigate(`/unidades/${r.id}`)}
        emptyMessage="Nenhuma unidade cadastrada."
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
