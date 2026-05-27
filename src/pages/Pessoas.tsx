import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listPessoas, setPessoaAtivo, convidarPessoa, resetSenhaUsuario } from '../lib/pessoas'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'
import PessoasImport from '../components/PessoasImport'

export default function Pessoas() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Pessoa[]>([])
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

  // Carrega unidades pra renderizar nomes
  useEffect(() => {
    listUnidades()
      .then(setUnidades)
      .catch(() => {})
  }, [])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const data = await listPessoas({
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

  async function handleToggleAtivo(row: Pessoa) {
    const novoEstado = !row.ativo
    const aviso = novoEstado
      ? `Reativar "${row.nome}"?${row.user_id ? '\nO acesso à conta será restaurado.' : ''}`
      : `Desativar "${row.nome}"?${row.user_id ? '\nA conta será BLOQUEADA imediatamente.' : ''}`
    if (!window.confirm(aviso)) return
    const r = await setPessoaAtivo(row.id, novoEstado)
    if (!r.ok) {
      alert('Erro: ' + r.error)
      return
    }
    await reload()
  }

  async function handleResetSenha(row: Pessoa) {
    if (!row.user_id) {
      alert('Pessoa ainda sem conta. Use "Convidar".')
      return
    }
    if (!window.confirm(`Enviar link de redefinição de senha pra ${row.email}?`)) return
    const r = await resetSenhaUsuario(row.id)
    if (r.ok) alert(`✓ Link de redefinição enviado pra ${r.email}.`)
    else alert('Erro: ' + r.error)
  }

  async function handleConvidar(row: Pessoa) {
    if (!row.email) {
      alert('Cadastra o e-mail antes de convidar.')
      return
    }
    if (row.user_id) {
      alert('Essa pessoa já tem conta vinculada.')
      return
    }
    if (!window.confirm(`Enviar convite por e-mail pra ${row.email}?\nEla vai receber link pra ativar conta.`)) return
    const r = await convidarPessoa(row.id)
    if (r.ok) {
      alert(`✓ Convite enviado pra ${r.email}.`)
      await reload()
    } else {
      alert('Erro: ' + r.error)
    }
  }

  const unidadeLabel = (uid: string | null) => {
    if (!uid) return '—'
    const u = unidades.find((x) => x.id === uid)
    if (!u) return '—'
    return u.bloco ? `${u.bloco}-${u.numero}` : u.numero
  }

  const columns: Column<Pessoa>[] = [
    { key: 'nome', header: 'Nome', render: (r) => <span className="font-medium text-slate-100">{r.nome}</span> },
    { key: 'unidade', header: 'Unidade', render: (r) => unidadeLabel(r.unidade_id) },
    { key: 'vinculo', header: 'Vínculo', render: (r) => <span className="capitalize text-slate-300">{r.tipo_vinculo}</span> },
    { key: 'email', header: 'E-mail', render: (r) => r.email ?? '—' },
    { key: 'telefone', header: 'Telefone', render: (r) => r.telefone ? formatPhone(r.telefone) : '—' },
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
        title={`Pessoas (${rows.length})`}
        subtitle="Moradores, dependentes, inquilinos e funcionários."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </Button>
            <Link to="/pessoas/novo">
              <Button>+ Nova pessoa</Button>
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
        onRowClick={(r) => navigate(`/pessoas/${r.id}`)}
        emptyMessage="Nenhuma pessoa cadastrada."
        actions={(r) => (
          <div className="flex gap-1 justify-end">
            <Link to={`/pessoas/${r.id}`}>
              <Button variant="ghost">Editar</Button>
            </Link>
            {r.email && !r.user_id && r.ativo && (
              <Button variant="secondary" onClick={() => handleConvidar(r)} title="Enviar convite por e-mail">
                ✉ Convidar
              </Button>
            )}
            {r.user_id && r.ativo && (
              <Button variant="ghost" onClick={() => handleResetSenha(r)} title="Enviar link de redefinição de senha">
                🔑 Reset
              </Button>
            )}
            <Button variant={r.ativo ? 'danger' : 'secondary'} onClick={() => handleToggleAtivo(r)}>
              {r.ativo ? 'Desativar' : 'Reativar'}
            </Button>
          </div>
        )}
      />

      {isGestor(perfil?.role) && (perfil?.condominio_id || (isAdmin && scopeId)) && (
        <div className="mt-10">
          <h2 className="text-base font-semibold text-slate-200 mb-1">Importar em massa</h2>
          <p className="text-xs text-slate-400 mb-4">
            Envie sua planilha em Excel ou CSV. Cria unidades automaticamente quando "Bloco-Número" não existir. Linhas duplicadas (mesmo CPF ou e-mail) são ignoradas.
          </p>
          <PessoasImport condominio_id={(perfil?.condominio_id ?? scopeId) as string} />
        </div>
      )}
    </div>
  )
}

function formatPhone(digits: string): string {
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return digits
}
