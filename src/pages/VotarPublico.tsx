import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

interface PublicInfo {
  votacao: {
    id: string
    titulo: string
    descricao: string | null
    aberta: boolean
    status: string
    data_fim: string | null
    requer_codigo: boolean
  }
  condominio: { nome: string | null; logo_url: string | null }
  opcoes: Array<{ id: string; texto: string }>
  unidades: Array<{ id: string; label: string }>
}

export default function VotarPublico() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [info, setInfo] = useState<PublicInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [opcaoId, setOpcaoId] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [criarConta, setCriarConta] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState(false)
  const [erroVoto, setErroVoto] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    ;(async () => {
      // Quem já está logado vota pelo app (fluxo interno).
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { navigate(`/votacoes/${id}`, { replace: true }); return }
      try {
        const { data, error } = await supabase.functions.invoke('votacao-publica', {
          body: { action: 'info', votacao_id: id },
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        if (alive) setInfo(data as PublicInfo)
      } catch (e) {
        if (alive) setErro(e instanceof Error ? e.message : 'Não foi possível carregar a votação.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, navigate])

  async function enviarVoto() {
    if (!id) return
    if (!opcaoId) { setErroVoto('Escolha uma opção.'); return }
    if (!unidadeId) { setErroVoto('Selecione sua unidade.'); return }
    if (!nome.trim()) { setErroVoto('Informe seu nome.'); return }
    if (info?.votacao.requer_codigo && !codigo.trim()) { setErroVoto('Informe o código de acesso.'); return }
    if (criarConta) {
      if (!email.trim()) { setErroVoto('Informe seu e-mail.'); return }
      if (senha.length < 8) { setErroVoto('A senha precisa ter no mínimo 8 caracteres.'); return }
    }
    setEnviando(true)
    setErroVoto(null)
    try {
      const { data, error } = await supabase.functions.invoke('votacao-publica', {
        body: criarConta
          ? {
              action: 'cadastrar_votar',
              votacao_id: id,
              opcao_id: opcaoId,
              unidade_id: unidadeId,
              nome: nome.trim(),
              email: email.trim(),
              senha,
              codigo: codigo.trim(),
            }
          : {
              action: 'votar',
              votacao_id: id,
              opcao_id: opcaoId,
              unidade_id: unidadeId,
              eleitor_nome: nome.trim(),
              codigo: codigo.trim(),
            },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      // Cadastro: já loga e leva pro app.
      if (criarConta && data?.session) {
        await supabase.auth.setSession(data.session)
        navigate(`/votacoes/${id}`, { replace: true })
        return
      }
      setFeito(true)
    } catch (e) {
      setErroVoto(e instanceof Error ? e.message : 'Erro ao registrar o voto.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          {info?.condominio.logo_url
            ? <img src={info.condominio.logo_url} alt="" className="w-10 h-10 object-contain rounded" />
            : <Logo size={36} />}
          <div className="text-sm font-bold">{info?.condominio.nome ?? 'OnWay Condomínio'}</div>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 text-sm py-10">Carregando votação...</div>
        ) : erro ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">{erro}</div>
        ) : feito ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-lg font-semibold text-emerald-100">Voto registrado!</div>
            <p className="text-sm text-slate-300 mt-1">Obrigado por participar. Você pode fechar esta página.</p>
          </div>
        ) : info ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h1 className="text-xl font-bold">{info.votacao.titulo}</h1>
            {info.votacao.descricao && <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{info.votacao.descricao}</p>}

            {!info.votacao.aberta ? (
              <div className="mt-4 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-400">
                Esta votação está encerrada.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-2">Seu voto</div>
                  <div className="space-y-2">
                    {info.opcoes.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setOpcaoId(o.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                          opcaoId === o.id
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-100'
                            : 'bg-slate-800/40 border-slate-700 text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        <span className="font-medium">{o.texto}</span>
                        {opcaoId === o.id && <span className="ml-2 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Sua unidade</label>
                  <select
                    value={unidadeId}
                    onChange={(e) => setUnidadeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {info.unidades.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Seu nome</label>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                  />
                </div>

                {info.votacao.requer_codigo && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Código de acesso</label>
                    <input
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="código exibido na assembleia"
                      className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                    />
                  </div>
                )}

                <div className="flex gap-2 rounded-lg bg-slate-800/40 p-1">
                  <button
                    type="button"
                    onClick={() => setCriarConta(false)}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition ${!criarConta ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  >
                    Votar sem conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriarConta(true)}
                    className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition ${criarConta ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  >
                    Criar conta e votar
                  </button>
                </div>

                {criarConta && (
                  <div className="space-y-3 rounded-lg border border-slate-800 p-3">
                    <p className="text-[11px] text-slate-400">Cria sua conta de morador já vinculada à unidade e abre o app.</p>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">E-mail</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Senha (mín. 8)</label>
                      <input
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="crie uma senha"
                        className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                      />
                    </div>
                  </div>
                )}

                {erroVoto && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2 text-sm">{erroVoto}</div>
                )}

                <button
                  onClick={enviarVoto}
                  disabled={enviando}
                  className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition disabled:opacity-50"
                >
                  {enviando ? 'Registrando...' : criarConta ? 'Criar conta e votar' : 'Confirmar voto'}
                </button>

                <p className="text-[11px] text-slate-500 text-center">
                  1 voto por unidade. Já tem conta?{' '}
                  <Link to="/login" className="text-emerald-400 hover:underline">entre pelo app</Link>.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
