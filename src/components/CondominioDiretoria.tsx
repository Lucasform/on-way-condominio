import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { isGestor } from '../lib/permissions'
import { roleLabel } from '../lib/nav'
import type { Role } from '../types/database'
import Button from './ui/Button'
import { Select } from './ui/Input'

interface PerfilLinha {
  id: string
  nome_exibicao: string | null
  role: Role
  ativo: boolean
  user_email?: string | null
}

interface Props {
  condominio_id?: string
}

const CARGOS_DIRETORIA: Role[] = ['sindico', 'subsindico', 'conselheiro']

function msgErro(e: unknown): string {
  if (!e) return 'Erro desconhecido.'
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return JSON.stringify(e).slice(0, 200)
}

export default function CondominioDiretoria({ condominio_id }: Props) {
  const { perfil: meuPerfil } = useAuth()
  const [diretoria, setDiretoria] = useState<PerfilLinha[]>([])
  const [candidatos, setCandidatos] = useState<PerfilLinha[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [novoPerfilId, setNovoPerfilId] = useState<string>('')
  const [novoCargo, setNovoCargo] = useState<Role>('subsindico')
  const [busy, setBusy] = useState(false)
  const [busca, setBusca] = useState('')
  const [comboAberto, setComboAberto] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  const candidatosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return candidatos
    return candidatos.filter((c) => {
      const nome = (c.nome_exibicao ?? '').toLowerCase()
      return nome.includes(q) || roleLabel(c.role).toLowerCase().includes(q)
    })
  }, [busca, candidatos])

  const perfilSelecionado = useMemo(
    () => candidatos.find((c) => c.id === novoPerfilId) ?? null,
    [candidatos, novoPerfilId],
  )

  // Fecha o combo ao clicar fora
  useEffect(() => {
    if (!comboAberto) return
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [comboAberto])

  const podeGerenciar = isGestor(meuPerfil?.role)

  async function carregar() {
    if (!condominio_id) {
      setError('Salve o condomínio antes de gerenciar a diretoria.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('perfis')
        .select('id, nome_exibicao, role, ativo')
        .eq('condominio_id', condominio_id)
        .eq('ativo', true)
        .order('role')
        .order('nome_exibicao')
      if (e1) throw e1
      const linhas = (data ?? []) as PerfilLinha[]
      setDiretoria(linhas.filter((p) => CARGOS_DIRETORIA.includes(p.role)))
      setCandidatos(linhas.filter((p) => !CARGOS_DIRETORIA.includes(p.role) && p.role !== 'admin_onway'))
    } catch (e) {
      console.warn('[diretoria] erro ao carregar:', e)
      setError(msgErro(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio_id])

  async function atribuir() {
    if (!novoPerfilId) return
    setBusy(true)
    setError(null)
    try {
      // Se está virando síndico, garante que nenhum outro síndico ativo existe
      if (novoCargo === 'sindico') {
        const ja = diretoria.find((d) => d.role === 'sindico')
        if (ja) {
          if (!window.confirm(`Já existe um síndico: ${ja.nome_exibicao ?? '(sem nome)'}. Substituir e rebaixar o atual a subsíndico?`)) {
            setBusy(false)
            return
          }
          // rebaixa o atual a subsindico
          const { error: eDown } = await supabase
            .from('perfis').update({ role: 'subsindico' }).eq('id', ja.id)
          if (eDown) throw eDown
        }
      }
      const { error: eUp } = await supabase
        .from('perfis').update({ role: novoCargo }).eq('id', novoPerfilId)
      if (eUp) throw eUp
      setShowAdd(false)
      setNovoPerfilId('')
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atribuir cargo.')
    } finally {
      setBusy(false)
    }
  }

  async function removerCargo(p: PerfilLinha) {
    if (!window.confirm(`Remover ${roleLabel(p.role)} de ${p.nome_exibicao ?? '(sem nome)'}? A pessoa volta a ser morador.`)) return
    setBusy(true)
    try {
      const { error: e } = await supabase
        .from('perfis').update({ role: 'morador' }).eq('id', p.id)
      if (e) throw e
      await carregar()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setBusy(false)
    }
  }

  async function trocarCargo(p: PerfilLinha, novo: Role) {
    if (novo === 'sindico') {
      const ja = diretoria.find((d) => d.role === 'sindico' && d.id !== p.id)
      if (ja) {
        if (!window.confirm(`Já existe um síndico: ${ja.nome_exibicao ?? '(sem nome)'}. Substituir e rebaixar o atual a subsíndico?`)) return
        await supabase.from('perfis').update({ role: 'subsindico' }).eq('id', ja.id)
      }
    }
    setBusy(true)
    try {
      const { error: e } = await supabase
        .from('perfis').update({ role: novo }).eq('id', p.id)
      if (e) throw e
      await carregar()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Diretoria</h2>
          <p className="text-xs text-slate-400">
            Síndico responsável, subsíndico e conselheiros. Pessoas com perfil ativo no condomínio podem ser promovidas.
          </p>
        </div>
        {podeGerenciar && !showAdd && (
          <Button variant="secondary" onClick={() => setShowAdd(true)}>+ Atribuir cargo</Button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
            <div ref={comboRef} className="relative">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Pessoa <span className="text-slate-600">({candidatos.length} elegíveis)</span>
              </label>
              <input
                type="text"
                value={
                  perfilSelecionado && !comboAberto
                    ? `${perfilSelecionado.nome_exibicao ?? '(sem nome)'} — ${roleLabel(perfilSelecionado.role)}`
                    : busca
                }
                onChange={(e) => {
                  setBusca(e.target.value)
                  setComboAberto(true)
                  if (novoPerfilId) setNovoPerfilId('')
                }}
                onFocus={() => setComboAberto(true)}
                placeholder="Digite para buscar pelo nome..."
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-700 focus:outline-none"
              />
              {comboAberto && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
                  {candidatosFiltrados.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">
                      {candidatos.length === 0
                        ? 'Nenhuma pessoa cadastrada com acesso ao app ainda.'
                        : 'Nenhum resultado para essa busca.'}
                    </div>
                  ) : (
                    candidatosFiltrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setNovoPerfilId(c.id)
                          setBusca('')
                          setComboAberto(false)
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 transition flex items-center justify-between gap-3"
                      >
                        <span className="text-sm text-slate-100 truncate">
                          {c.nome_exibicao ?? '(sem nome)'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">
                          {roleLabel(c.role)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Cargo</label>
              <Select value={novoCargo} onChange={(e) => setNovoCargo(e.target.value as Role)}>
                <option value="sindico">Síndico</option>
                <option value="subsindico">Subsíndico</option>
                <option value="conselheiro">Conselheiro</option>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={atribuir} disabled={busy || !novoPerfilId}>Confirmar</Button>
              <Button variant="secondary" onClick={() => { setShowAdd(false); setNovoPerfilId(''); setBusca('') }}>Cancelar</Button>
            </div>
          </div>
          {candidatos.length === 0 && !loading && !error && (
            <div className="text-xs text-slate-500">
              Nenhuma pessoa elegível. Convide moradores ou outros perfis pela seção <strong>Convites</strong> abaixo.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : diretoria.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 text-center text-sm text-slate-500">
          Nenhum cargo atribuído ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {diretoria.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-100 truncate">
                  {p.nome_exibicao ?? '(sem nome)'}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">{roleLabel(p.role)}</div>
              </div>
              {podeGerenciar && (
                <div className="flex items-center gap-2">
                  <Select value={p.role} onChange={(e) => trocarCargo(p, e.target.value as Role)}>
                    <option value="sindico">Síndico</option>
                    <option value="subsindico">Subsíndico</option>
                    <option value="conselheiro">Conselheiro</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removerCargo(p)}
                    title="Remover da diretoria"
                    className="p-2 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
