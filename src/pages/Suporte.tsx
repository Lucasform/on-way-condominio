import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { useToast } from '../components/ui/Toast'

type Status = 'novo' | 'em_analise' | 'resolvido' | 'arquivado'
type Tipo = 'sugestao' | 'problema' | 'elogio' | 'outro'

interface FeedbackItem {
  id: string
  tipo: Tipo
  mensagem: string
  status: Status
  created_at: string
  condominio_id: string | null
  autor_id: string | null
  condominios?: { nome: string } | null
  perfis?: { nome_exibicao: string | null; email: string | null } | null
}

const COLUNAS: { id: Status; label: string; cor: string }[] = [
  { id: 'novo',       label: 'Enviado',    cor: 'border-slate-600' },
  { id: 'em_analise', label: 'Em análise', cor: 'border-amber-500' },
  { id: 'resolvido',  label: 'Resolvido',  cor: 'border-emerald-500' },
  { id: 'arquivado',  label: 'Arquivado',  cor: 'border-slate-700' },
]

const TIPO_BADGE: Record<Tipo, { label: string; cls: string }> = {
  sugestao: { label: 'Sugestão',    cls: 'bg-violet-500/20 text-violet-300' },
  problema: { label: 'Problema',    cls: 'bg-red-500/20 text-red-300' },
  elogio:   { label: 'Elogio',      cls: 'bg-emerald-500/20 text-emerald-300' },
  outro:    { label: 'Outro',       cls: 'bg-slate-500/20 text-slate-300' },
}

export default function Suporte() {
  const toast = useToast()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('feedback')
      .select('*, condominios(nome), perfis:autor_id(nome_exibicao, email)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar', error.message)
    else setItems((data ?? []) as FeedbackItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function moverPara(id: string, novoStatus: Status) {
    setMoving(id)
    const { error } = await supabase
      .from('feedback')
      .update({ status: novoStatus })
      .eq('id', id)
    if (error) toast.error('Erro ao mover', error.message)
    else setItems((prev) => prev.map((f) => f.id === id ? { ...f, status: novoStatus } : f))
    setMoving(null)
  }

  const porColuna = (status: Status) => items.filter((f) => f.status === status)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1600px] mx-auto">
      <PageHeader
        title="Suporte"
        subtitle="Mensagens enviadas pelos usuários via botão de feedback."
      />

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          {COLUNAS.map((col) => (
            <div key={col.id} className={`rounded-xl border-t-2 ${col.cor} bg-slate-900/50 p-4 space-y-3 min-h-[200px]`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-200">{col.label}</h3>
                <span className="text-xs text-slate-500 font-mono">{porColuna(col.id).length}</span>
              </div>

              {porColuna(col.id).length === 0 && (
                <p className="text-xs text-slate-600 italic">Nenhum item</p>
              )}

              {porColuna(col.id).map((f) => (
                <div key={f.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TIPO_BADGE[f.tipo].cls}`}>
                      {TIPO_BADGE[f.tipo].label}
                    </span>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {new Date(f.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">{f.mensagem}</p>

                  {(f.condominios?.nome || f.perfis?.nome_exibicao || f.perfis?.email) && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {f.condominios?.nome && <span className="mr-1">{f.condominios.nome}</span>}
                      {(f.perfis?.nome_exibicao || f.perfis?.email) && (
                        <span className="text-slate-600">· {f.perfis?.nome_exibicao ?? f.perfis?.email}</span>
                      )}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 pt-1">
                    {COLUNAS.filter((c) => c.id !== f.status).map((c) => (
                      <button
                        key={c.id}
                        disabled={moving === f.id}
                        onClick={() => moverPara(f.id, c.id)}
                        className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500 transition disabled:opacity-40"
                      >
                        {moving === f.id ? '...' : `→ ${c.label}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
