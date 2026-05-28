import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { isStaff } from '../lib/permissions'
import { listVersoes, criarSnapshot, type RegimentoVersao } from '../lib/regimentoVersoes'
import Button from './ui/Button'
import { Field, TextInput } from './ui/Input'

interface Props {
  condominio_id: string | null
}

export default function RegimentoVersoes({ condominio_id }: Props) {
  const { user, perfil } = useAuth()
  const podeGerenciar = isStaff(perfil?.role)

  const [versoes, setVersoes] = useState<RegimentoVersao[]>([])
  const [loading, setLoading] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto || !condominio_id) return
    setLoading(true)
    listVersoes(condominio_id)
      .then(setVersoes)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro.'))
      .finally(() => setLoading(false))
  }, [aberto, condominio_id])

  async function snapshot() {
    if (!condominio_id || !user) return
    setSalvando(true)
    setError(null)
    try {
      await criarSnapshot({
        condominio_id,
        motivo: motivo || undefined,
        user_id: user.id,
      })
      setMotivo('')
      const novas = await listVersoes(condominio_id)
      setVersoes(novas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar snapshot.')
    } finally {
      setSalvando(false)
    }
  }

  if (!condominio_id) return null

  return (
    <section className="mt-8 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-200">📚 Histórico de versões</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Snapshots imutáveis do regimento. Multas guardam referência à versão vigente.
          </p>
        </div>
        <span className="text-slate-400 text-sm">{aberto ? '▾ Recolher' : `▸ ${versoes.length || ''} versões`}</span>
      </button>

      {aberto && (
        <div className="mt-4 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {podeGerenciar && (
            <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 space-y-2">
              <Field label="Motivo do snapshot" hint="Ex: aprovado em assembleia 12/05/2026">
                <TextInput
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Opcional"
                />
              </Field>
              <Button onClick={snapshot} disabled={salvando}>
                {salvando ? 'Capturando...' : '📸 Capturar snapshot agora'}
              </Button>
            </div>
          )}

          {loading ? (
            <div className="text-sm text-slate-500">Carregando...</div>
          ) : versoes.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-center text-sm text-slate-500">
              Nenhuma versão capturada ainda. Crie um snapshot pra começar a versionar.
            </div>
          ) : (
            <ol className="space-y-2">
              {versoes.map((v) => {
                const isOpen = expandida === v.id
                return (
                  <li key={v.id} className="rounded-md border border-slate-800 bg-slate-900/40">
                    <button
                      type="button"
                      onClick={() => setExpandida(isOpen ? null : v.id)}
                      className="w-full flex items-baseline justify-between gap-3 px-3 py-2 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-100">
                          v{v.versao_num}
                          <span className="text-slate-500 ml-2 text-xs font-normal">
                            {new Date(v.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {v.motivo && <div className="text-xs text-slate-400 mt-0.5 truncate">{v.motivo}</div>}
                      </div>
                      <span className="text-xs text-slate-500">
                        {v.total_artigos} artigo{v.total_artigos !== 1 ? 's' : ''} {isOpen ? '▾' : '▸'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-800 px-3 py-2 max-h-80 overflow-y-auto">
                        {v.snapshot.length === 0 ? (
                          <div className="text-xs text-slate-500 italic">Snapshot vazio.</div>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {v.snapshot.map((a, i) => (
                              <li key={i} className="border-l-2 border-slate-700 pl-3">
                                <div className="text-xs text-slate-500">
                                  {a.numero ?? `#${i + 1}`}{a.ativo === false ? ' (inativo)' : ''}
                                </div>
                                <div className="text-slate-200 font-medium">{a.titulo}</div>
                                <p className="text-slate-300 text-xs mt-0.5 whitespace-pre-wrap line-clamp-3">{a.conteudo}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
