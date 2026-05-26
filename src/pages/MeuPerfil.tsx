import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { roleLabel } from '../lib/nav'
import PushToggle from '../components/PushToggle'
import TwoFactorPanel from '../components/TwoFactorPanel'
import PageHeader from '../components/ui/PageHeader'

interface Pessoa {
  id: string
  condominio_id: string
  unidade_id: string | null
  user_id: string | null
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  foto_url: string | null
  tipo_vinculo: string
  relacao_unidade: string | null
}

const AVATAR_BUCKET = 'avatares'
const ASSINATURA_BUCKET = 'assinaturas'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_ASSINATURA_BYTES = 1 * 1024 * 1024 // 1 MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ROLES_QUE_ASSINAM: string[] = ['admin_onway', 'administradora', 'sindico']

export default function MeuPerfil() {
  const { user, perfil, refreshPerfil } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [condoNome, setCondoNome] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome_exibicao: '',
    telefone: '',
    bio: '',
  })
  const [novoEmail, setNovoEmail] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const assinaturaInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAssinatura, setUploadingAssinatura] = useState(false)
  const podeAssinar = !!perfil && ROLES_QUE_ASSINAM.includes(perfil.role)

  useEffect(() => {
    if (!perfil || !user) return
    setForm({
      nome_exibicao: perfil.nome_exibicao ?? '',
      telefone: maskTelefone(perfil.telefone ?? ''),
      bio: perfil.bio ?? '',
    })
    setNovoEmail(user.email ?? '')
  }, [perfil, user])

  useEffect(() => {
    if (!user) return
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('pessoas')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (mounted && data) setPessoa(data as Pessoa)
    })()
    return () => { mounted = false }
  }, [user])

  useEffect(() => {
    if (!perfil?.condominio_id) { setCondoNome(null); return }
    let mounted = true
    supabase.from('condominios').select('nome').eq('id', perfil.condominio_id).maybeSingle()
      .then(({ data }) => { if (mounted && data) setCondoNome(data.nome) })
    return () => { mounted = false }
  }, [perfil?.condominio_id])

  function flash(kind: 'ok' | 'err', msg: string) {
    setFeedback({ kind, msg })
    if (kind === 'ok') window.setTimeout(() => setFeedback(null), 3000)
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!perfil) return
    setSavingProfile(true)
    setFeedback(null)

    const telefoneClean = form.telefone.replace(/\D/g, '') || null
    const updates = {
      nome_exibicao: form.nome_exibicao.trim() || null,
      telefone: telefoneClean,
      bio: form.bio.trim() || null,
    }

    const { error } = await supabase.from('perfis').update(updates).eq('id', perfil.id)
    if (error) {
      flash('err', traduzirErro(error.message))
      setSavingProfile(false)
      return
    }

    // Se há pessoa vinculada, sincroniza nome/telefone pra evitar dados desencontrados
    if (pessoa) {
      await supabase.from('pessoas').update({
        nome: updates.nome_exibicao ?? pessoa.nome,
        telefone: telefoneClean,
      }).eq('id', pessoa.id)
    }

    await refreshPerfil()
    setSavingProfile(false)
    flash('ok', 'Dados salvos.')
  }

  async function handleAvatarChange(file: File | null) {
    if (!file || !user || !perfil) return

    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      flash('err', 'Use uma imagem JPG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      flash('err', `Imagem muito grande. Máximo ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)} MB.`)
      return
    }

    setUploadingAvatar(true)
    setFeedback(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      const publicUrl = pub.publicUrl

      const { error: updErr } = await supabase
        .from('perfis')
        .update({ avatar_url: publicUrl })
        .eq('id', perfil.id)
      if (updErr) throw updErr

      // Apaga avatar anterior (best-effort)
      if (perfil.avatar_url) {
        const prevPath = extrairPathDoPublicUrl(perfil.avatar_url, AVATAR_BUCKET)
        if (prevPath && prevPath.startsWith(`${user.id}/`)) {
          supabase.storage.from(AVATAR_BUCKET).remove([prevPath]).catch(() => {})
        }
      }

      await refreshPerfil()
      flash('ok', 'Foto atualizada.')
    } catch (err) {
      flash('err', traduzirErro(err instanceof Error ? err.message : 'Falha no upload.'))
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    if (!perfil?.avatar_url || !user) return
    if (!window.confirm('Remover sua foto de perfil?')) return
    setUploadingAvatar(true)
    setFeedback(null)

    const prevPath = extrairPathDoPublicUrl(perfil.avatar_url, AVATAR_BUCKET)
    const { error } = await supabase.from('perfis').update({ avatar_url: null }).eq('id', perfil.id)
    if (error) {
      flash('err', traduzirErro(error.message))
      setUploadingAvatar(false)
      return
    }
    if (prevPath && prevPath.startsWith(`${user.id}/`)) {
      supabase.storage.from(AVATAR_BUCKET).remove([prevPath]).catch(() => {})
    }
    await refreshPerfil()
    setUploadingAvatar(false)
    flash('ok', 'Foto removida.')
  }

  // ============================================================
  // Assinatura digital (imagem) — só pra staff que assina documentos
  // ============================================================

  async function handleAssinaturaChange(file: File | null) {
    if (!file || !user || !perfil) return
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      flash('err', 'Use uma imagem JPG, PNG ou WebP. PNG transparente fica melhor.')
      return
    }
    if (file.size > MAX_ASSINATURA_BYTES) {
      flash('err', `Imagem muito grande. Máximo ${Math.round(MAX_ASSINATURA_BYTES / 1024 / 1024)} MB.`)
      return
    }
    setUploadingAssinatura(true)
    setFeedback(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(ASSINATURA_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(ASSINATURA_BUCKET).getPublicUrl(path)
      const novaUrl = pub.publicUrl

      const { error: updErr } = await supabase
        .from('perfis')
        .update({ assinatura_url: novaUrl })
        .eq('id', perfil.id)
      if (updErr) throw updErr

      if (perfil.assinatura_url) {
        const prevPath = extrairPathDoPublicUrl(perfil.assinatura_url, ASSINATURA_BUCKET)
        if (prevPath && prevPath.startsWith(`${user.id}/`)) {
          supabase.storage.from(ASSINATURA_BUCKET).remove([prevPath]).catch(() => {})
        }
      }

      await refreshPerfil()
      flash('ok', 'Assinatura atualizada.')
    } catch (err) {
      flash('err', traduzirErro(err instanceof Error ? err.message : 'Falha no upload.'))
    } finally {
      setUploadingAssinatura(false)
      if (assinaturaInputRef.current) assinaturaInputRef.current.value = ''
    }
  }

  async function handleRemoveAssinatura() {
    if (!perfil?.assinatura_url || !user) return
    if (!window.confirm('Remover sua assinatura?')) return
    setUploadingAssinatura(true)
    const prevPath = extrairPathDoPublicUrl(perfil.assinatura_url, ASSINATURA_BUCKET)
    const { error } = await supabase.from('perfis').update({ assinatura_url: null }).eq('id', perfil.id)
    if (error) {
      flash('err', traduzirErro(error.message))
      setUploadingAssinatura(false)
      return
    }
    if (prevPath && prevPath.startsWith(`${user.id}/`)) {
      supabase.storage.from(ASSINATURA_BUCKET).remove([prevPath]).catch(() => {})
    }
    await refreshPerfil()
    setUploadingAssinatura(false)
    flash('ok', 'Assinatura removida.')
  }

  async function handleChangeEmail(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const next = novoEmail.trim().toLowerCase()
    if (!next || next === (user.email ?? '').toLowerCase()) return

    setSavingEmail(true)
    setFeedback(null)
    const { error } = await supabase.auth.updateUser({ email: next })
    setSavingEmail(false)
    if (error) {
      flash('err', traduzirErro(error.message))
      return
    }
    flash('ok', 'Confirme nos dois e-mails (atual e novo) pra concluir a alteração.')
  }

  if (!perfil || !user) {
    return <div className="px-8 py-10 text-slate-500 dark:text-slate-400">Carregando seu perfil...</div>
  }

  const iniciais = (perfil.nome_exibicao ?? user.email ?? '?').slice(0, 1).toUpperCase()
  const emailMudou = (novoEmail.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) && novoEmail.trim().length > 0

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader title="Meu perfil" subtitle="Seus dados, contato e segurança." />

      {feedback && (
        <div
          className={`mb-6 text-sm rounded-md px-3 py-2 border ${
            feedback.kind === 'ok'
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
              : 'text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/30'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* ============================================================ */}
      {/* Identidade */}
      {/* ============================================================ */}
      <Section title="Identidade">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-28 h-28 rounded-full bg-brand-50 dark:bg-brand-700/20 border-2 border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center text-3xl font-bold text-brand-700 dark:text-brand-300 hover:border-brand-500 transition disabled:opacity-50"
                title="Trocar foto"
              >
                {perfil.avatar_url ? (
                  <img src={perfil.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  iniciais
                )}
              </button>
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-700 text-white text-xs flex items-center justify-center border-2 border-white dark:border-slate-950 pointer-events-none">
                📷
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
            />
            {perfil.avatar_url && !uploadingAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="text-[11px] text-slate-500 hover:text-red-600 dark:hover:text-red-400 underline-offset-2 hover:underline"
              >
                remover
              </button>
            )}
            {uploadingAvatar && <div className="text-[11px] text-slate-500">enviando...</div>}
          </div>

          <form onSubmit={handleSaveProfile} className="flex-1 space-y-4">
            <Field label="Nome de exibição">
              <input
                value={form.nome_exibicao}
                onChange={(e) => setForm({ ...form, nome_exibicao: e.target.value })}
                placeholder="Como você quer ser chamado"
                className={inputCls}
                maxLength={80}
              />
            </Field>

            <Field label="Telefone" hint="WhatsApp ou celular pra contato.">
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                className={inputCls}
                maxLength={16}
              />
            </Field>

            <Field label="Bio" hint="Opcional. Aparece pra outras pessoas do condomínio.">
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                maxLength={280}
                className={`${inputCls} resize-none`}
                placeholder="Conte um pouco sobre você"
              />
              <div className="mt-1 text-right text-[11px] text-slate-400">{form.bio.length}/280</div>
            </Field>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {savingProfile ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>
      </Section>

      {/* ============================================================ */}
      {/* Assinatura digital — só pra staff que assina documentos */}
      {/* ============================================================ */}
      {podeAssinar && (
        <Section
          title="Assinatura digital"
          hint="Imagem da sua assinatura. Aparece no rodapé de PDFs de multa e notificação que você emitir. PNG transparente fica melhor."
        >
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={() => assinaturaInputRef.current?.click()}
                disabled={uploadingAssinatura}
                title="Trocar assinatura"
                className="w-64 h-24 rounded-md border-2 border-dashed border-slate-700 bg-slate-900 hover:border-brand-500 transition disabled:opacity-50 flex items-center justify-center overflow-hidden"
              >
                {perfil.assinatura_url ? (
                  <img
                    src={perfil.assinatura_url}
                    alt="Sua assinatura"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-500">clique pra adicionar</span>
                )}
              </button>
              <input
                ref={assinaturaInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleAssinaturaChange(e.target.files?.[0] ?? null)}
              />
              {perfil.assinatura_url && !uploadingAssinatura && (
                <button
                  type="button"
                  onClick={handleRemoveAssinatura}
                  className="text-[11px] text-slate-500 hover:text-red-400 underline-offset-2 hover:underline"
                >
                  remover
                </button>
              )}
              {uploadingAssinatura && <div className="text-[11px] text-slate-500">enviando...</div>}
            </div>
            <div className="flex-1 text-xs text-slate-400 space-y-2">
              <p>
                <strong className="text-slate-200">Dica:</strong> assine numa folha branca, fotografe ou
                escaneie. Use ferramenta como remove.bg pra deixar fundo transparente (PNG) — fica mais elegante no PDF.
              </p>
              <p className="text-[11px] text-slate-500">
                Esta é uma <strong>assinatura visual</strong> (imagem). Não substitui assinatura digital
                ICP-Brasil pra fins jurídicos. Serve pra notificações internas e processos administrativos
                do condomínio.
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* ============================================================ */}
      {/* Contato — Email */}
      {/* ============================================================ */}
      <Section title="E-mail" hint="Usado pra login. Trocar exige confirmação nos dois endereços.">
        <form onSubmit={handleChangeEmail} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <Field label="E-mail atual" className="flex-1">
            <input
              type="email"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              className={inputCls}
              autoComplete="email"
            />
          </Field>
          <button
            type="submit"
            disabled={savingEmail || !emailMudou}
            className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
          >
            {savingEmail ? 'Enviando...' : 'Alterar e-mail'}
          </button>
        </form>
      </Section>

      {/* ============================================================ */}
      {/* Segurança */}
      {/* ============================================================ */}
      <Section title="Segurança">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">Senha</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Recomendado trocar a cada 90 dias.
              </div>
            </div>
            <Link
              to="/atualizar-senha"
              className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm hover:bg-slate-300 dark:hover:bg-slate-700"
            >
              Alterar senha
            </Link>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
            <TwoFactorPanel />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
            <PushToggle />
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/* Conta — info da sessão */}
      {/* ============================================================ */}
      <Section title="Conta">
        <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
          <dt className="text-slate-500 dark:text-slate-400">Papel</dt>
          <dd className="text-slate-900 dark:text-slate-100">{roleLabel(perfil.role)}</dd>

          {condoNome && (
            <>
              <dt className="text-slate-500 dark:text-slate-400">Condomínio</dt>
              <dd className="text-slate-900 dark:text-slate-100">{condoNome}</dd>
            </>
          )}

          <dt className="text-slate-500 dark:text-slate-400">Conta criada</dt>
          <dd className="text-slate-900 dark:text-slate-100">
            {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}
          </dd>

          {user.last_sign_in_at && (
            <>
              <dt className="text-slate-500 dark:text-slate-400">Último acesso</dt>
              <dd className="text-slate-900 dark:text-slate-100">
                {new Date(user.last_sign_in_at).toLocaleString('pt-BR')}
              </dd>
            </>
          )}

          <dt className="text-slate-500 dark:text-slate-400">ID</dt>
          <dd className="text-[11px] font-mono text-slate-500">{user.id}</dd>
        </dl>
      </Section>

      {/* ============================================================ */}
      {/* Vínculo com unidade (se houver pessoa) */}
      {/* ============================================================ */}
      {pessoa && (
        <Section
          title="Vínculo com o condomínio"
          hint="Dados de morador. Pra alterar, fale com a administração."
        >
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Vínculo</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {pessoa.tipo_vinculo}
              {pessoa.relacao_unidade && ` · ${pessoa.relacao_unidade}`}
            </dd>

            {pessoa.cpf && (
              <>
                <dt className="text-slate-500 dark:text-slate-400">CPF</dt>
                <dd className="text-slate-900 dark:text-slate-100">{pessoa.cpf}</dd>
              </>
            )}

            {pessoa.data_nascimento && (
              <>
                <dt className="text-slate-500 dark:text-slate-400">Nascimento</dt>
                <dd className="text-slate-900 dark:text-slate-100">
                  {new Date(pessoa.data_nascimento + 'T12:00').toLocaleDateString('pt-BR')}
                </dd>
              </>
            )}
          </dl>
        </Section>
      )}

      {/* ============================================================ */}
      {/* LGPD */}
      {/* ============================================================ */}
      <Section title="Privacidade (LGPD)" hint="Direito de portabilidade e exclusão dos seus dados.">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportarMeusDados(perfil, pessoa, user.email)}
            className="px-4 py-2 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            📥 Baixar meus dados
          </button>
          <button
            type="button"
            onClick={solicitarExclusao}
            className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition"
          >
            🗑 Solicitar exclusão da conta
          </button>
        </div>
      </Section>
    </div>
  )
}

// ============================================================
// UI helpers
// ============================================================

const inputCls =
  'w-full px-3 py-2 rounded-md bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 text-sm text-slate-900 dark:text-slate-100'

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </label>
  )
}

// ============================================================
// Helpers
// ============================================================

function maskTelefone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function extrairPathDoPublicUrl(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

function traduzirErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('email rate limit')) return 'Muitas tentativas. Espere alguns minutos.'
  if (m.includes('already registered') || m.includes('user already')) return 'Esse e-mail já está em uso.'
  if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido.'
  if (m.includes('password')) return 'Problema com a senha. Confira e tente de novo.'
  return msg
}

async function exportarMeusDados(perfil: { id: string; role: string }, pessoa: Pessoa | null, email: string | undefined) {
  const { data: u } = await supabase.auth.getUser()
  const payload = {
    exportado_em: new Date().toISOString(),
    usuario: { id: u.user?.id, email, created_at: u.user?.created_at },
    perfil,
    pessoa: pessoa ?? null,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const stamp = new Date().toISOString().slice(0, 10)
  a.download = `meus-dados-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function solicitarExclusao() {
  const conf = window.prompt(
    'Tem certeza? Sua conta será desativada e enviada pra revisão de exclusão.\nDigite EXCLUIR pra confirmar:',
  )
  if (conf !== 'EXCLUIR') return
  const { error } = await supabase.functions.invoke('solicitar-exclusao-conta', {})
  if (error) {
    alert('Erro ao solicitar: ' + error.message)
    return
  }
  alert('Solicitação registrada. Você receberá um e-mail em até 5 dias úteis.')
  await supabase.auth.signOut()
  window.location.href = '/entrar'
}
