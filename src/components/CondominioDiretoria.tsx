import { useEffect, useState } from 'react'
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
  condominio_id: string
}

const CARGOS_DIRETORIA: Role[] = ['sindico', 'subsindico', 'conselheiro']

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

  const podeGerenciar = isGestor(meuPerfil?.role)

  async function carregar() {
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
      // candidatos: perfis ativos do condo que NÃO estão na diretoria (moradores, portaria etc.)
      setCandidatos(linhas.filter((p) => !CARGOS_DIRETORIA.includes(p.role) && p.role !== 'admin_onway'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
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
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Pessoa</label>
              <Select value={novoPerfilId} onChange={(e) => setNovoPerfilId(e.target.value)}>
                <option value="">Selecione...</option>
                {candidatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_exibicao ?? '(sem nome)'} — {roleLabel(c.role)}
                  </option>
                ))}
              </Select>
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
              <Button variant="secondary" onClick={() => { setShowAdd(false); setNovoPerfilId('') }}>Cancelar</Button>
            </div>
          </div>
          {candidatos.length === 0 && (
            <div className="text-xs text-slate-500">
              Não há pessoas elegíveis. Cadastre/convide moradores ou outros perfis ativos primeiro.
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
