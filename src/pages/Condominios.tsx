import { useEffect, useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { listCondominios, setCondominioAtivo } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DataTable, { type Column } from '../components/ui/DataTable'
import { useAuth } from '../components/AuthProvider'

export default function Condominios() {
  const navigate = useNavigate()
  const { perfil } = useAuth()

  // Admin em "view as" enxerga apenas o condomínio assumido — vai direto pro detalhe
  if (perfil?.role === 'admin_onway' && perfil.condominio_id) {
    return <Navigate to={`/condominios/${perfil.condominio_id}`} replace />
  }
  const [rows, setRows] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listCondominios(
        showInactive ? {} : { ativo: true },
      )
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive])

  async function handleToggleAtivo(row: Condominio) {
    const novoEstado = !row.ativo
    const msg = novoEstado
      ? `Reativar "${row.nome}"?`
      : `Desativar "${row.nome}"? (soft delete, pode ser revertido depois)`
    if (!window.confirm(msg)) return
    try {
      await setCondominioAtivo(row.id, novoEstado)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar.')
    }
  }

  const columns: Column<Condominio>[] = [
    { key: 'nome', header: 'Nome', render: (r) => <span className="font-medium text-slate-100">{r.nome}</span> },
    { key: 'cidade', header: 'Cidade', render: (r) => formatCidade(r) },
    { key: 'plano', header: 'Plano', render: (r) => <PlanoBadge plano={r.plano} /> },
    { key: 'ativo', header: 'Status', render: (r) => <StatusBadge ativo={r.ativo} /> },
  ]

  return (
    <div className="px-8 py-10 max-w-6xl">
      <PageHeader
        title="Condomínios"
        subtitle="Gestão dos condomínios cadastrados na plataforma."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </Button>
            <Link to="/condominios/novo">
              <Button>+ Novo condomínio</Button>
            </Link>
          </>
        }
      />

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
        onRowClick={(r) => navigate(`/condominios/${r.id}`)}
        emptyMessage="Nenhum condomínio cadastrado."
        actions={(r) => (
          <div className="flex gap-1 justify-end">
            <Link to={`/condominios/${r.id}`}>
              <Button variant="ghost">Editar</Button>
            </Link>
            <Button
              variant={r.ativo ? 'danger' : 'secondary'}
              onClick={() => handleToggleAtivo(r)}
            >
              {r.ativo ? 'Desativar' : 'Reativar'}
            </Button>
          </div>
        )}
      />
    </div>
  )
}

function formatCidade(r: Condominio): string {
  if (!r.cidade && !r.estado) return '—'
  return `${r.cidade ?? '—'}${r.estado ? `/${r.estado}` : ''}`
}

function PlanoBadge({ plano }: { plano: string }) {
  const map: Record<string, string> = {
    free: 'bg-slate-700/40 text-slate-300',
    pro: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    enterprise: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wide ${map[plano] ?? map.free}`}>
      {plano}
    </span>
  )
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
      Ativo
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded text-xs bg-slate-700/40 text-slate-400">
      Inativo
    </span>
  )
}
