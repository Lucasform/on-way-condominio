import { useEffect, useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { listCondominios, setCondominioAtivo } from '../lib/condominios'
import type { Condominio } from '../types/condominio'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Pill from '../components/ui/Pill'
import DataTable, { type Column } from '../components/ui/DataTable'
import { useAuth } from '../components/AuthProvider'

export default function Condominios() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

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
    const ok = await confirm({
      title: novoEstado ? 'Restaurar condomínio' : 'Arquivar condomínio',
      message: novoEstado
        ? `Restaurar "${row.nome}"? Volta a aparecer pra todos.`
        : `Arquivar "${row.nome}"? Os dados ficam preservados, mas o condomínio some da operação.`,
      tone: novoEstado ? 'primary' : 'danger',
      confirmText: novoEstado ? 'Restaurar' : 'Arquivar',
    })
    if (!ok) return
    try {
      await setCondominioAtivo(row.id, novoEstado)
      await reload()
      toast.success(novoEstado ? 'Condomínio restaurado.' : 'Condomínio arquivado.')
    } catch (e) {
      toast.error('Erro ao atualizar', e instanceof Error ? e.message : '')
    }
  }

  const ativosCount = rows.filter((r) => r.ativo).length
  const arquivadosCount = rows.length - ativosCount

  const columns: Column<Condominio>[] = [
    { key: 'nome', header: 'Nome', render: (r) => <span className="font-medium text-slate-100">{r.nome}</span> },
    { key: 'cidade', header: 'Cidade', render: (r) => formatCidade(r) },
    { key: 'ativo', header: 'Status', render: (r) => <StatusBadge ativo={r.ativo} /> },
  ]

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-6xl mx-auto">
      <PageHeader
        title={`${ativosCount === 1 ? 'Condomínio' : 'Condomínios'} (${ativosCount}${showInactive && arquivadosCount > 0 ? ` + ${arquivadosCount} arquivados` : ''})`}
        subtitle="Gestão dos condomínios cadastrados na plataforma."
        actions={
          <div className="flex gap-2">
            <Button
              variant={showInactive ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? '✓ Mostrando arquivados' : '📦 Mostrar arquivados'}
            </Button>
            <Link to="/condominios/novo">
              <Button>+ Novo condomínio</Button>
            </Link>
          </div>
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
              <Button variant="ghost" size="sm">Editar</Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleToggleAtivo(r)}
            >
              {r.ativo ? '📦 Arquivar' : '↻ Restaurar'}
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

function StatusBadge({ ativo }: { ativo: boolean }) {
  return ativo
    ? <Pill tone="success" dot>Ativo</Pill>
    : <Pill tone="neutral">📦 Arquivado</Pill>
}
