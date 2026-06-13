import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { listComunicados } from '../lib/comunicados'
import { isGestor } from '../lib/permissions'
import type { Comunicado, StatusComunicado } from '../types/comunicado'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import CondominioAnexosManager from '../components/CondominioAnexosManager'

const STATUS_LABEL: Record<StatusComunicado, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  arquivado: 'Arquivado',
}

const STATUS_CLASS: Record<StatusComunicado, string> = {
  rascunho: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  enviado: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  arquivado: 'bg-slate-700/40 text-slate-400 border-slate-700',
}

export default function Comunicados() {
  const { perfil } = useAuth()
  const gestor = isGestor(perfil?.role)
  const [rows, setRows] = useState<Comunicado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!perfil?.condominio_id && perfil?.role !== 'admin_onway') {
      setLoading(false)
      return
    }
    listComunicados({ condominio_id: perfil?.condominio_id ?? undefined })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [perfil])

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title={`Comunicados (${rows.length})`}
        subtitle="Avisos coletivos para os moradores, com geração assistida por IA."
        actions={
          gestor && (
            <Link to="/comunicados/novo">
              <Button>+ Novo comunicado</Button>
            </Link>
          )
        }
      />

      {gestor && perfil?.condominio_id && (
        <details className="mb-6 rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800/40 transition">
            📣 Modelos de comunicado
            <span className="text-xs text-slate-500 font-normal ml-2">
              (modelo que a IA segue ao gerar)
            </span>
          </summary>
          <div className="px-5 pb-5 pt-2">
            <CondominioAnexosManager
              condominio_id={perfil.condominio_id}
              tipo="modelo_comunicado"
              titulo="Modelos de comunicado"
              emoji="📣"
              descricao="Anexe modelos PDF (aviso de manutenção, festa, regra nova). O agente IA segue o tom e a estrutura desses modelos."
            />
          </div>
        </details>
      )}

      {loading && <div className="text-slate-400 text-sm">Carregando...</div>}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-slate-500 italic rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center">
          Nenhum comunicado ainda.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              to={`/comunicados/${r.id}`}
              className="block rounded-lg border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">{r.titulo}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {r.enviado_em && (
                      <> · enviado em {new Date(r.enviado_em).toLocaleDateString('pt-BR')}</>
                    )}
                    {r.destinatarios > 0 && <> · {r.destinatarios} destinatários</>}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

