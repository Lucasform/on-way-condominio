import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { isStaff } from '../lib/permissions'
import {
  listMandatos,
  createMandato,
  encerrarMandato,
  deleteMandato,
  mandatosVencendoEm,
  type Mandato,
  type CargoDiretoria,
} from '../lib/diretoriaMandatos'
import Button from './ui/Button'
import { Field, Select, TextInput, TextArea } from './ui/Input'

interface PerfilOpcao {
  id: string
  nome_exibicao: string | null
}

const CARGOS: { v: CargoDiretoria; l: string }[] = [
  { v: 'sindico', l: 'Síndico' },
  { v: 'subsindico', l: 'Subsíndico' },
  { v: 'conselheiro', l: 'Conselheiro' },
  { v: 'administradora', l: 'Administradora' },
]

interface Props {
  condominio_id?: string
}

export default function CondominioMandatos({ condominio_id }: Props) {
  const { perfil: meuPerfil } = useAuth()
  const podeGerenciar = isStaff(meuPerfil?.role)

  const [mandatos, setMandatos] = useState<Mandato[]>([])
  const [perfis, setPerfis] = useState<PerfilOpcao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    perfil_id: '',
    cargo: 'sindico' as CargoDiretoria,
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: '',
    observacoes: '',
  })

  async function reload() {
    if (!condominio_id) {
      setError('Salve o condomínio antes de registrar mandatos.')
      setLoading(false)
      return
    }
    setLoading(true); setError(null)
    try {
      const [ms, { data: perfisData, error: perfisErr }] = await Promise.all([
        listMandatos({ condominio_id, apenas_ativos: false }),
        supabase.from('perfis').select('id, nome_exibicao').eq('condominio_id', condominio_id).eq('ativo', true).order('nome_exibicao'),
      ])
      if (perfisErr) throw perfisErr
      setMandatos(ms)
      setPerfis((perfisData ?? []) as PerfilOpcao[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominio_id])

  const vencendo = useMemo(() => mandatosVencendoEm(mandatos, 30), [mandatos])
  const ativos = mandatos.filter((m) => m.ativo)
  const inativos = mandatos.filter((m) => !m.ativo)

  async function salvar() {
    if (!condominio_id) return
    if (!form.perfil_id) { setError('Selecione a pessoa.'); return }
    setBusy(true); setError(null)
    try {
      await createMandato({
        condominio_id,
        perfil_id: form.perfil_id,
        cargo: form.cargo,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        observacoes: form.observacoes || null,
      })
      setShowForm(false)
      setForm({ perfil_id: '', cargo: 'sindico', data_inicio: new Date().toISOString().slice(0, 10), data_fim: '', observacoes: '' })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setBusy(false)
    }
  }

  async function encerrar(m: Mandato) {
    if (!window.confirm(`Encerrar mandato de ${nomePerfil(m.perfil_id, perfis)} (${cargoLabel(m.cargo)}) hoje?`)) return
    try {
      await encerrarMandato(m.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  async function remover(m: Mandato) {
    if (!window.confirm('Apagar mandato definitivamente?')) return
    try {
      await deleteMandato(m.id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro.')
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Mandatos</h2>
          <p className="text-xs text-slate-400">
            Histórico formal com início, fim e cargo. Aviso amarelo aparece quando o fim está em &lt; 30 dias.
          </p>
        </div>
        {podeGerenciar && !showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)}>+ Novo mandato</Button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {vencendo.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          ⚠ {vencendo.length} mandato{vencendo.length > 1 ? 's vencem' : ' vence'} nos próximos 30 dias.
        </div>
      )}

      {showForm && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Pessoa" required>
              <Select value={form.perfil_id} onChange={(e) => setForm({ ...form, perfil_id: e.target.value })}>
                <option value="">Selecione...</option>
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome_exibicao ?? '(sem nome)'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Cargo" required>
              <Select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value as CargoDiretoria })}>
                {CARGOS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </Select>
            </Field>
            <Field label="Início" required>
              <TextInput
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </Field>
            <Field label="Fim previsto (opcional)" hint="Datas no futuro geram alerta de vencimento próximo.">
              <TextInput
                type="date"
                value={form.data_fim}
                onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                onFocus={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </Field>
          </div>
          <Field label="Observações">
            <TextArea
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={salvar} disabled={busy}>Salvar mandato</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : ativos.length === 0 && inativos.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 text-center text-sm text-slate-500">
          Nenhum mandato registrado.
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {ativos.map((m) => {
              const proximo = vencendo.some((x) => x.id === m.id)
              return (
                <li
                  key={m.id}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                    proximo
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-100 truncate">
                      {nomePerfil(m.perfil_id, perfis)} · {cargoLabel(m.cargo)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {fmtDate(m.data_inicio)} → {m.data_fim ? fmtDate(m.data_fim) : 'sem fim previsto'}
                      {proximo && <span className="ml-2 text-amber-400">vence em breve</span>}
                    </div>
                    {m.observacoes && <div className="text-xs text-slate-400 mt-0.5">{m.observacoes}</div>}
                  </div>
                  {podeGerenciar && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => encerrar(m)}
                        className="text-xs text-slate-400 hover:text-slate-100 px-2 py-1"
                        title="Encerrar mandato hoje"
                      >
                        encerrar
                      </button>
                      <button
                        onClick={() => remover(m)}
                        className="text-xs text-slate-500 hover:text-red-400 px-2 py-1"
                        title="Apagar definitivo"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {inativos.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                Mandatos encerrados ({inativos.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {inativos.map((m) => (
                  <li key={m.id} className="text-xs text-slate-500 px-3 py-1.5 rounded border border-slate-800 bg-slate-900/20">
                    {nomePerfil(m.perfil_id, perfis)} · {cargoLabel(m.cargo)} ·{' '}
                    {fmtDate(m.data_inicio)} → {m.data_fim ? fmtDate(m.data_fim) : '—'}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function nomePerfil(id: string, perfis: PerfilOpcao[]): string {
  return perfis.find((p) => p.id === id)?.nome_exibicao ?? id.slice(0, 8) + '…'
}

function cargoLabel(c: CargoDiretoria): string {
  return CARGOS.find((x) => x.v === c)?.l ?? c
}

function fmtDate(iso: string): string {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') } catch { return iso }
}
