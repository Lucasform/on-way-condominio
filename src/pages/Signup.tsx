import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  previewConvite,
  redeemInviteCode,
  listarUnidadesDeConvite,
  type ConvitePreview,
  type UnidadeConvite,
  type TipoVinculo,
} from '../lib/convites'
import { useAuth } from '../components/AuthProvider'
import AuthShell from '../components/AuthShell'
import { validatePassword, PASSWORD_HINT } from '../lib/passwordPolicy'

const inputCls =
  'w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 ' +
  'text-slate-100 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 text-sm'

const primaryBtn =
  'w-full py-2 rounded-md bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-semibold text-sm transition disabled:opacity-50'

const VINCULOS_RESIDENCIAIS: { value: TipoVinculo; label: string }[] = [
  { value: 'titular',    label: 'Titular (proprietário)' },
  { value: 'conjuge',    label: 'Cônjuge' },
  { value: 'filho',      label: 'Filho(a)' },
  { value: 'dependente', label: 'Dependente' },
  { value: 'inquilino',  label: 'Inquilino' },
  { value: 'morador',    label: 'Morador (genérico)' },
]

function ROLE_LABEL(role: string | null): string {
  switch (role) {
    case 'morador': return 'Morador'
    case 'portaria': return 'Portaria'
    case 'ronda': return 'Ronda'
    case 'administradora': return 'Administradora'
    case 'sindico': return 'Síndico'
    case 'subsindico': return 'Subsíndico'
    case 'conselheiro': return 'Conselheiro'
    default: return role ?? '?'
  }
}

export default function Signup() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  // Etapa
  const [etapa, setEtapa] = useState<'codigo' | 'dados'>('codigo')

  // Etapa 1
  const [codigo, setCodigo] = useState('')
  const [validando, setValidando] = useState(false)
  const [preview, setPreview] = useState<ConvitePreview | null>(null)
  const [unidades, setUnidades] = useState<UnidadeConvite[]>([])

  // Etapa 2
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [unidadeId, setUnidadeId] = useState<string>('')
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo | ''>('')
  const [setor, setSetor] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [aceitouTermos, setAceitouTermos] = useState(false)

  // Comuns
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-500">Carregando...</div>
  }
  if (user) return <Navigate to="/" replace />

  async function handleValidarCodigo(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!codigo.trim()) {
      setError('Informe o código de convite.')
      return
    }
    setValidando(true)
    try {
      const pv = await previewConvite(codigo)
      if (!pv) { setError('Código não encontrado.'); return }
      if (!pv.valido) {
        const motivos: Record<string, string> = {
          codigo_nao_encontrado: 'Código não encontrado.',
          revogado: 'Código foi revogado.',
          expirado: 'Código expirado.',
          esgotado: 'Código já atingiu o limite de usos.',
        }
        setError(motivos[pv.motivo ?? ''] ?? 'Código inválido.')
        return
      }
      setPreview(pv)
      if (pv.pessoa_nome) setNome(pv.pessoa_nome)
      if (pv.unidade_id) setUnidadeId(pv.unidade_id)
      if (pv.tipo_vinculo) setTipoVinculo(pv.tipo_vinculo)
      if (pv.setor) setSetor(pv.setor)

      // Pré-carrega unidades só se for morador e o código não travou a unidade
      if (pv.role === 'morador' && !pv.unidade_id) {
        try {
          const us = await listarUnidadesDeConvite(codigo)
          setUnidades(us)
        } catch (e) {
          console.warn('Falha ao listar unidades:', e)
        }
      }

      setEtapa('dados')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao validar código.')
    } finally {
      setValidando(false)
    }
  }

  async function handleFinalizar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!preview) { setError('Valide o código antes.'); return }

    const v = validatePassword(password)
    if (!v.ok) { setError('Senha fraca: ' + v.errors.join(', ') + '.'); return }
    if (!aceitouTermos) { setError('Você precisa aceitar os termos de uso e a política de privacidade.'); return }

    if (preview.role === 'morador') {
      const uniFinal = preview.unidade_id ?? unidadeId
      if (!uniFinal) { setError('Selecione a unidade.'); return }
    }

    setSubmitting(true)
    const r = await redeemInviteCode({
      email,
      password,
      nome,
      codigo,
      unidade_id: preview.unidade_id ?? (unidadeId || null),
      tipo_vinculo: preview.tipo_vinculo ?? (tipoVinculo || null),
      setor: preview.setor ?? (setor || null),
      cpf: cpf || null,
      telefone: telefone || null,
    })
    setSubmitting(false)
    if (!r.ok) { setError(r.error ?? 'Erro ao criar conta.'); return }
    navigate('/', { replace: true })
  }

  // === Etapa 1: código ===
  if (etapa === 'codigo' || !preview) {
    return (
      <AuthShell
        title="Primeiro acesso"
        subtitle="Use o código de convite que sua administradora ou síndico enviou."
        footer={
          <>
            Já tem conta?{' '}
            <Link to="/login?tipo=morador" className="text-brand-400 font-medium hover:underline">
              Entrar
            </Link>
          </>
        }
      >
        <form onSubmit={handleValidarCodigo} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-300 mb-1">Código de convite</span>
            <input
              type="text"
              required
              autoComplete="off"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\s+/g, '').toUpperCase())}
              placeholder="EX: FLAMBOYANT2026"
              className={`${inputCls} tracking-wider uppercase`}
            />
            <span className="text-xs text-slate-500 mt-1 block">
              Não tem código? Peça pra sua administradora ou síndico.
            </span>
          </label>

          {error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={validando} className={primaryBtn}>
            {validando ? 'Validando...' : 'Continuar'}
          </button>
        </form>
      </AuthShell>
    )
  }

  // === Etapa 2: dados ===
  const isMorador = preview.role === 'morador'
  const isFuncionario = preview.role === 'portaria' || preview.role === 'ronda'
  const unidadeTravada = !!preview.unidade_id
  const vinculoTravado = !!preview.tipo_vinculo
  const setorTravado = !!preview.setor

  return (
    <AuthShell
      title={`Você entrará como ${ROLE_LABEL(preview.role)}`}
      subtitle={preview.nome_condominio ? `Condomínio: ${preview.nome_condominio}` : undefined}
      footer={
        <button
          type="button"
          onClick={() => { setEtapa('codigo'); setPreview(null) }}
          className="text-brand-400 font-medium hover:underline"
        >
          ← Trocar código
        </button>
      }
    >
      <form onSubmit={handleFinalizar} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">Nome completo</span>
          <input
            type="text" required value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={!!preview.pessoa_nome}
            className={inputCls}
          />
          {preview.pessoa_nome && (
            <span className="text-xs text-slate-500 mt-1 block">Nome travado pelo convite.</span>
          )}
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">E-mail</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">Senha</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          <span className="text-xs text-slate-500 mt-1 block">{PASSWORD_HINT}</span>
        </label>

        {isMorador && (
          <>
            <label className="block">
              <span className="block text-sm font-medium text-slate-300 mb-1">Unidade</span>
              {unidadeTravada ? (
                <input type="text" disabled value={preview.unidade_label ?? '(travada)'} className={inputCls} />
              ) : (
                <select required value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              )}
              {unidadeTravada && (
                <span className="text-xs text-slate-500 mt-1 block">Unidade definida pelo convite.</span>
              )}
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-300 mb-1">Vínculo com a unidade</span>
              <select
                value={tipoVinculo}
                onChange={(e) => setTipoVinculo(e.target.value as TipoVinculo)}
                disabled={vinculoTravado}
                className={inputCls}
              >
                <option value="">Selecione...</option>
                {VINCULOS_RESIDENCIAIS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
              {vinculoTravado && (
                <span className="text-xs text-slate-500 mt-1 block">Vínculo travado pelo convite.</span>
              )}
            </label>
          </>
        )}

        {isFuncionario && (
          <label className="block">
            <span className="block text-sm font-medium text-slate-300 mb-1">Setor / Função</span>
            <input
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              disabled={setorTravado}
              placeholder="Ex: Portaria diurna"
              className={inputCls}
            />
            {setorTravado && (
              <span className="text-xs text-slate-500 mt-1 block">Setor sugerido pelo convite.</span>
            )}
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-slate-300 mb-1">CPF <span className="text-slate-500 font-normal">(opcional)</span></span>
            <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-300 mb-1">Telefone <span className="text-slate-500 font-normal">(opcional)</span></span>
            <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} />
          </label>
        </div>

        <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={aceitouTermos}
            onChange={(e) => setAceitouTermos(e.target.checked)}
            className="mt-0.5 accent-brand-700"
          />
          <span>
            Li e aceito os{' '}
            <Link to="/termos" target="_blank" className="text-brand-400 hover:underline">termos de uso</Link>
            {' '}e a{' '}
            <Link to="/privacidade" target="_blank" className="text-brand-400 hover:underline">política de privacidade</Link>.
          </span>
        </label>

        {error && (
          <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className={primaryBtn}>
          {submitting ? 'Criando...' : 'Criar conta'}
        </button>
      </form>
    </AuthShell>
  )
}
