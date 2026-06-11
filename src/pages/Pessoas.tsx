import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listPessoas, setPessoaAtivo, convidarPessoa, resetSenhaUsuario, excluirUsuarioAuth } from '../lib/pessoas'
import { listCondominios } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'
import type { Unidade } from '../types/unidade'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { isGestor } from '../lib/permissions'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Tabs from '../components/ui/Tabs'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import DataTable, { type Column } from '../components/ui/DataTable'
import PessoasImport from '../components/PessoasImport'
import FuncionariosImport from '../components/FuncionariosImport'

export default function Pessoas() {
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [rows, setRows] = useState<Pessoa[]>([])
  const [tab, setTab] = useState<'moradores' | 'funcionarios' | 'diretoria' | 'sem_cadastro'>('moradores')
  const [diretoriaIds, setDiretoriaIds] = useState<Set<string>>(new Set())
  type PerfilSemCadastro = { id: string; nome_exibicao: string | null; role: string; email: string | null }
  const [perfisSemCadastro, setPerfisSemCadastro] = useState<PerfilSemCadastro[]>([])
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

  // Carrega ids de perfis na diretoria + perfis sem cadastro residencial.
  useEffect(() => {
    const condoId = isAdmin && scopeId ? scopeId : perfil?.condominio_id
    if (!condoId) { setDiretoriaIds(new Set()); setPerfisSemCadastro([]); return }
    import('../lib/supabase').then(async ({ supabase }) => {
      const { data: perfisAtivos } = await supabase
        .from('perfis')
        .select('id, nome_exibicao, role')
        .eq('condominio_id', condoId)
        .eq('ativo', true)
        .neq('role', 'admin_onway')
      const ids = (perfisAtivos ?? []).map((p) => p.id)
      const diretoria = (perfisAtivos ?? [])
        .filter((p) => ['sindico', 'subsindico', 'conselheiro'].includes(p.role))
        .map((p) => p.id)
      setDiretoriaIds(new Set(diretoria))
      // Quais ids de perfis ja tem registro em pessoas?
      const userIdsComPessoa = new Set(rows.filter((r) => r.user_id).map((r) => r.user_id as string))
      const semCadastro = (perfisAtivos ?? [])
        .filter((p) => !userIdsComPessoa.has(p.id))
        .map((p) => ({ id: p.id, nome_exibicao: p.nome_exibicao, role: p.role, email: null }))
      // Tenta buscar e-mails via RPC se existir (fallback silencioso)
      void ids
      setPerfisSemCadastro(semCadastro)
    })
  }, [isAdmin, scopeId, perfil?.condominio_id, rows])

  const RESIDENCIAIS = ['titular', 'conjuge', 'filho', 'dependente', 'inquilino', 'morador']

  const rowsFiltrados = (() => {
    if (tab === 'funcionarios') {
      return rows.filter((p) => p.tipo_vinculo === 'funcionario' || p.tipo_vinculo === 'outro')
    }
    if (tab === 'diretoria') {
      return rows.filter((p) => p.user_id && diretoriaIds.has(p.user_id))
    }
    return rows.filter((p) => RESIDENCIAIS.includes(p.tipo_vinculo))
  })()
  const totais = {
    moradores: rows.filter((p) => RESIDENCIAIS.includes(p.tipo_vinculo)).length,
    funcionarios: rows.filter((p) => p.tipo_vinculo === 'funcionario' || p.tipo_vinculo === 'outro').length,
    diretoria: rows.filter((p) => p.user_id && diretoriaIds.has(p.user_id)).length,
    sem_cadastro: perfisSemCadastro.length,
  }

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
    const ok = await confirm({
      title: novoEstado ? 'Reativar pessoa' : 'Desativar pessoa',
      message: novoEstado
        ? `Reativar "${row.nome}"?${row.user_id ? ' O acesso à conta será restaurado.' : ''}`
        : `Desativar "${row.nome}"?${row.user_id ? ' A conta será BLOQUEADA imediatamente.' : ''}`,
      tone: novoEstado ? 'primary' : 'danger',
      confirmText: novoEstado ? 'Reativar' : 'Desativar',
    })
    if (!ok) return
    const r = await setPessoaAtivo(row.id, novoEstado)
    if (!r.ok) {
      toast.error('Erro', r.error)
      return
    }
    toast.success(novoEstado ? 'Pessoa reativada.' : 'Pessoa desativada.')
    await reload()
  }

  async function handleResetSenha(row: Pessoa) {
    if (!row.user_id) {
      toast.warning('Pessoa ainda sem conta', 'Use "Convidar".')
      return
    }
    const ok = await confirm({ message: `Enviar link de redefinição de senha para ${row.email}?` })
    if (!ok) return
    const r = await resetSenhaUsuario(row.id)
    if (r.ok) toast.success('Link de redefinição enviado', r.email)
    else toast.error('Erro', r.error)
  }

  async function handleConvidar(row: Pessoa) {
    if (!row.email) {
      toast.warning('E-mail obrigatório', 'Cadastra o e-mail antes de convidar.')
      return
    }
    if (row.user_id) {
      toast.info('Já vinculada', 'Essa pessoa já tem conta no app.')
      return
    }
    const ok = await confirm({
      title: 'Enviar convite',
      message: `Enviar convite por e-mail para ${row.email}? Ela vai receber link para ativar a conta.`,
      confirmText: 'Enviar convite',
    })
    if (!ok) return
    const r = await convidarPessoa(row.id)
    if (r.ok) {
      toast.success('Convite enviado', r.email)
      await reload()
    } else {
      toast.error('Erro', r.error)
    }
  }

  async function handleExcluirConta(p: { id: string; nome_exibicao: string | null }) {
    const nome = p.nome_exibicao ?? '(sem nome)'
    const motivo = window.prompt(
      `Excluir DEFINITIVAMENTE a conta de "${nome}"?\n\n` +
      `Isso remove o login e envia um e-mail avisando.\n` +
      `Cadastros em /pessoas associados ficam sem login (você pode reaproveitá-los).\n\n` +
      `Motivo (opcional, vai no e-mail):`,
      '',
    )
    if (motivo === null) return // cancelou
    try {
      const r = await excluirUsuarioAuth(p.id, motivo || undefined)
      toast.success(r.email_enviado ? 'Conta excluída. E-mail enviado.' : 'Conta excluída (sem e-mail).')
      await reload()
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : String(e))
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
    ...(tab === 'funcionarios'
      ? [{ key: 'setor', header: 'Setor', render: (r: Pessoa) => r.setor ?? '—' } as Column<Pessoa>]
      : [{ key: 'unidade', header: 'Unidade', render: (r: Pessoa) => unidadeLabel(r.unidade_id) } as Column<Pessoa>]
    ),
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
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-6xl mx-auto">
      <PageHeader
        title={`Pessoas (${rowsFiltrados.length})`}
        subtitle="Moradores, funcionários e diretoria. Filtre pelas abas."
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

      <Tabs
        className="mb-4"
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: 'moradores', label: 'Moradores', icon: '🏠', count: totais.moradores },
          { key: 'funcionarios', label: 'Funcionários', icon: '🛠', count: totais.funcionarios },
          { key: 'diretoria', label: 'Diretoria', icon: '👔', count: totais.diretoria },
          { key: 'sem_cadastro', label: 'Sem cadastro', icon: '⚠', count: totais.sem_cadastro },
        ]}
      />

      {tab === 'sem_cadastro' ? (
        perfisSemCadastro.length === 0 ? (
          <EmptyState message="Todos os usuários ativos do condomínio têm cadastro residencial. 👍" />
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-500/30 text-xs text-amber-200">
              Esses usuários têm login no app mas ainda não foram cadastrados como pessoa. Cadastre pra associar a uma unidade (ou marcar como funcionário).
            </div>
            <ul className="divide-y divide-slate-800">
              {perfisSemCadastro.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">
                      {p.nome_exibicao ?? '(sem nome)'}
                    </div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">
                      {p.role}{p.email ? ` · ${p.email}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/pessoas/novo?user_id=${p.id}&nome=${encodeURIComponent(p.nome_exibicao ?? '')}`}>
                      <Button size="sm">+ Cadastrar</Button>
                    </Link>
                    {isGestor(perfil?.role) && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleExcluirConta(p)}
                        title="Excluir conta + e-mail de aviso"
                      >
                        🗑 Excluir
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          rows={rowsFiltrados}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={(r) => navigate(`/pessoas/${r.id}`)}
          emptyMessage={
            tab === 'moradores' ? 'Nenhum morador cadastrado nesse condomínio.'
            : tab === 'funcionarios' ? 'Nenhum funcionário cadastrado.'
            : 'Nenhuma pessoa com cargo na diretoria.'
          }
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
      )}

      {isGestor(perfil?.role) && (perfil?.condominio_id || (isAdmin && scopeId)) && tab !== 'sem_cadastro' && tab !== 'diretoria' && (
        <div className="mt-10">
          <h2 className="text-base font-semibold text-slate-200 mb-1">Importar em massa</h2>
          {tab === 'funcionarios' ? (
            <FuncionariosImport condominio_id={(perfil?.condominio_id ?? scopeId) as string} />
          ) : (
            <PessoasImport condominio_id={(perfil?.condominio_id ?? scopeId) as string} />
          )}
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
