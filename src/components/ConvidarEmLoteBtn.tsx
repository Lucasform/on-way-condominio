import { useEffect, useState } from 'react'
import { listPessoasSemConta, convidarPessoa } from '../lib/pessoas'

interface Props {
  condominioId: string
  onDone?: () => void
}

type Estado = 'idle' | 'enviando' | 'done'

interface Progresso {
  total: number
  enviados: number
  erros: number
  atual: string | null
}

export default function ConvidarEmLoteBtn({ condominioId, onDone }: Props) {
  const [semConta, setSemConta] = useState<{ id: string; nome: string; email: string }[]>([])
  const [estado, setEstado] = useState<Estado>('idle')
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)

  useEffect(() => {
    if (!condominioId) return
    listPessoasSemConta(condominioId)
      .then(setSemConta)
      .catch((e) => setErroCarregar(e instanceof Error ? e.message : 'Erro ao carregar.'))
  }, [condominioId])

  if (erroCarregar || semConta.length === 0) return null

  async function convidarTodos() {
    if (estado === 'enviando') return
    setEstado('enviando')
    const total = semConta.length
    let enviados = 0
    let erros = 0

    for (const p of semConta) {
      setProgresso({ total, enviados, erros, atual: p.nome })
      const r = await convidarPessoa(p.id)
      if (r.ok) enviados++
      else erros++
      setProgresso({ total, enviados, erros, atual: p.nome })
    }

    setProgresso({ total, enviados, erros, atual: null })
    setEstado('done')
    setSemConta([])
    onDone?.()
  }

  if (estado === 'done' && progresso) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
        <span className="text-emerald-400 text-base">✓</span>
        <span className="text-emerald-300 flex-1">
          {progresso.enviados} convite{progresso.enviados !== 1 ? 's' : ''} enviado{progresso.enviados !== 1 ? 's' : ''}.
          {progresso.erros > 0 && (
            <span className="text-amber-400 ml-1">
              {progresso.erros} falha{progresso.erros !== 1 ? 's' : ''} (verifique os e-mails individualmente).
            </span>
          )}
        </span>
      </div>
    )
  }

  if (estado === 'enviando' && progresso) {
    const pct = Math.round(((progresso.enviados + progresso.erros) / progresso.total) * 100)
    return (
      <div className="mb-4 rounded-lg border border-brand-500/30 bg-brand-500/5 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Enviando convites... {progresso.enviados + progresso.erros}/{progresso.total}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {progresso.atual && (
          <p className="text-xs text-slate-500 truncate">Enviando para {progresso.atual}...</p>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-amber-300">
          {semConta.length} morador{semConta.length !== 1 ? 'es' : ''} sem acesso ao app
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          Têm e-mail cadastrado mas ainda não receberam convite.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void convidarTodos()}
        className="shrink-0 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold transition"
      >
        ✉ Convidar todos
      </button>
    </div>
  )
}
