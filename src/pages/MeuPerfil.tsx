import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { roleLabel } from '../lib/nav'
import PushToggle from '../components/PushToggle'
import TwoFactorPanel from '../components/TwoFactorPanel'
import MeusCondominios from '../components/MeusCondominios'
import Tabs from '../components/ui/Tabs'
import { updateCanaisNotificacao } from '../lib/pessoas'
import { sendPush, getPushStatus } from '../lib/push'
import { CANAIS_NOTIFICACAO_PADRAO, type CanaisNotificacao } from '../types/pessoa'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { removeWhiteBackground } from '../lib/removeBackground'

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
  canais_notificacao: CanaisNotificacao | null
}

const AVATAR_BUCKET = 'avatares'
const ASSINATURA_BUCKET = 'assinaturas'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_ASSINATURA_BYTES = 1 * 1024 * 1024 // 1 MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ROLES_QUE_ASSINAM: string[] = ['admin_onway', 'administradora', 'sindico', 'subsindico']

export default function MeuPerfil() {
  const { user, perfil, refreshPerfil } = useAuth()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pessoa, setPessoa] = useState<Pessoa | null>(null)
  const [canais, setCanais] = useState<CanaisNotificacao>(CANAIS_NOTIFICACAO_PADRAO)
  const [savingCanais, setSavingCanais] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [testPushMsg, setTestPushMsg] = useState<string | null>(null)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [condoNome, setCondoNome] = useState<string | null>(null)
  const [aba, setAba] = useState<'perfil' | 'acesso' | 'notificacoes' | 'conta'>('perfil')

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
  const [assinaturaPreview, setAssinaturaPreview] = useState<{ original: string; processed: string; file: File } | null>(null)
  const [processandoAssinatura, setProcessandoAssinatura] = useState(false)
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
      if (mounted && data) {
        setPessoa(data as Pessoa)
        setCanais((data as Pessoa).canais_notificacao ?? CANAIS_NOTIFICACAO_PADRAO)
      }
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

  async function toggleCanal(canal: keyof CanaisNotificacao) {
    if (!pessoa) return
    const prev = canais
    const next = { ...canais, [canal]: !canais[canal] }
    setCanais(next)
    setSavingCanais(true)
    try {
      await updateCanaisNotificacao(pessoa.id, next)
    } catch (e) {
      setCanais(prev)
      flash('err', e instanceof Error ? e.message : 'Erro ao salvar preferência.')
    } finally {
      setSavingCanais(false)
    }
  }

  useEffect(() => {
    if (aba !== 'notificacoes') return
    getPushStatus().then((s) => setPushSubscribed(s.subscribed)).catch(() => {})
  }, [aba])

  async function handleTestPush() {
    if (!user) return
    const status = await getPushStatus()
    if (!status.subscribed) {
      setTestPushMsg('not-subscribed')
      return
    }
    setTestingPush(true)
    setTestPushMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { user_ids: [user.id], titulo: '🔔 Teste OnWay', corpo: 'Push funcionando! Você receberá alertas mesmo com o app fechado.' },
      })
      if (error) throw error
      const result = data as { total: number; ok: number; fail: number }
      if (result.total === 0) setTestPushMsg('no-sub')
      else if (result.ok > 0) setTestPushMsg('ok')
      else setTestPushMsg('err')
    } catch {
      setTestPushMsg('err')
    } finally {
      setTestingPush(false)
    }
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
    const ok = await confirm({ message: 'Remover sua foto de perfil?', tone: 'danger', confirmText: 'Remover' })
    if (!ok) return
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
    // Show background removal preview before uploading
    setProcessandoAssinatura(true)
    try {
      const originalUrl = URL.createObjectURL(file)
      const { file: processedFile, previewUrl } = await removeWhiteBackground(file)
      setAssinaturaPreview({ original: originalUrl, processed: previewUrl, file: processedFile })
    } catch {
      await uploadAssinatura(file)
    } finally {
      setProcessandoAssinatura(false)
    }
  }

  async function uploadAssinatura(file: File) {
    if (!user || !perfil) return
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

  async function confirmAssinaturaPreview() {
    if (!assinaturaPreview) return
    const { file } = assinaturaPreview
    URL.revokeObjectURL(assinaturaPreview.original)
    setAssinaturaPreview(null)
    await uploadAssinatura(file)
  }

  function cancelAssinaturaPreview() {
    if (assinaturaPreview) URL.revokeObjectURL(assinaturaPreview.original)
    setAssinaturaPreview(null)
    if (assinaturaInputRef.current) assinaturaInputRef.current.value = ''
  }

  async function handleRemoveAssinatura() {
    if (!perfil?.assinatura_url || !user) return
    const ok = await confirm({ message: 'Remover sua assinatura?', tone: 'danger', confirmText: 'Remover' })
    if (!ok) return
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
    return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando seu perfil...</div>
  }

  const iniciais = (perfil.nome_exibicao ?? user.email ?? '?').slice(0, 1).toUpperCase()
  const emailMudou = (novoEmail.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) && novoEmail.trim().length > 0

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
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

      <MeusCondominios />

      <Tabs
        className="mb-6"
        value={aba}
        onChange={(k) => setAba(k as typeof aba)}
        tabs={[
          { key: 'perfil', label: 'Perfil', icon: '👤' },
          { key: 'acesso', label: 'Acesso & segurança', icon: '🔒' },
          { key: 'notificacoes', label: 'Notificações', icon: '🔔' },
          { key: 'conta', label: 'Conta', icon: '⚙️' },
        ]}
      />

      {aba === 'perfil' && (
      <>
      {/* Identidade */}
      <Section title="Identidade">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-28 h-28 rounded-full bg-brand-700/20 border-2 border-slate-700 overflow-hidden flex items-center justify-center text-3xl font-bold text-brand-300 hover:border-brand-500 transition disabled:opacity-50"
                title="Trocar foto"
              >
                {perfil.avatar_url ? (
                  <img src={perfil.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  iniciais
                )}
              </button>
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-700 text-white text-xs flex items-center justify-center border-2 border-slate-950 pointer-events-none">
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

            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar alterações'}
            </Button>
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
              {processandoAssinatura && <div className="text-[11px] text-slate-500">processando...</div>}
              {uploadingAssinatura && <div className="text-[11px] text-slate-500">enviando...</div>}
            </div>
            <div className="flex-1 text-xs text-slate-400 space-y-2">
              <p>
                <strong className="text-slate-200">Dica:</strong> assine numa folha branca e fotografe ou escaneie. O app remove o fundo automaticamente ao subir a imagem.
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

      </>
      )}

      {aba === 'acesso' && (
      <>
      {/* Contato — Email */}
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
            className="px-4 py-2 rounded-md bg-slate-800 text-slate-200 font-medium text-sm hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
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
              <div className="font-medium text-slate-100">Senha</div>
              <div className="text-xs text-slate-400">
                Recomendado trocar a cada 90 dias.
              </div>
            </div>
            <Link
              to="/atualizar-senha"
              className="px-4 py-2 rounded-md bg-slate-800 text-slate-200 font-medium text-sm hover:bg-slate-700"
            >
              Alterar senha
            </Link>
          </div>

          <div className="border-t border-slate-800 pt-5">
            <TwoFactorPanel />
          </div>

          <div className="border-t border-slate-800 pt-5">
            <PushToggle />
          </div>
        </div>
      </Section>

      </>
      )}

      {/* Preferências de notificação — só pra quem tem cadastro residencial */}
      {aba === 'notificacoes' && pessoa && (
        <Section
          title="Como você quer ser avisado"
          hint="Escolha por quais canais quer receber avisos do condomínio (multas, notificações, encomendas). O sininho dentro do app é sempre mantido."
        >
          <div className="space-y-3">
            {([
              { k: 'email' as const, label: 'E-mail', icon: '✉️', detail: pessoa.email ?? 'sem e-mail cadastrado' },
              { k: 'whatsapp' as const, label: 'WhatsApp', icon: '🟢', detail: pessoa.telefone ?? 'sem telefone cadastrado' },
              { k: 'push' as const, label: 'Notificação push', icon: '🔔', detail: 'alerta no celular/navegador' },
            ]).map(({ k, label, icon, detail }) => (
              <label
                key={k}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-4 py-3 cursor-pointer hover:border-slate-700 transition"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-100">{label}</span>
                    <span className="block text-xs text-slate-400 truncate">{detail}</span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={canais[k]}
                  disabled={savingCanais}
                  onChange={() => toggleCanal(k)}
                  className="w-5 h-5 shrink-0 accent-brand-600"
                />
              </label>
            ))}
          </div>
        </Section>
      )}

      {aba === 'notificacoes' && (
        <Section title="Notificações push neste dispositivo">
          <div className="space-y-3">
            {!pushSubscribed ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 space-y-1">
                <p className="font-medium">Push não ativado neste dispositivo</p>
                <p className="text-xs text-amber-300/80">Acesse a aba <strong>Acesso &amp; segurança</strong> e clique em <strong>Ativar</strong> para receber notificações.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400">Push ativo neste dispositivo. Envie uma notificação de teste agora.</p>
                <Button variant="secondary" onClick={handleTestPush} disabled={testingPush}>
                  {testingPush ? 'Enviando...' : '🔔 Enviar notificação de teste'}
                </Button>
                {testPushMsg === 'ok' && (
                  <p className="text-xs text-emerald-400">Notificação enviada. Verifique seu celular/navegador.</p>
                )}
                {testPushMsg === 'no-sub' && (
                  <p className="text-xs text-amber-400">Nenhuma subscription encontrada no banco. Tente desativar e reativar o push.</p>
                )}
                {testPushMsg === 'err' && (
                  <p className="text-xs text-red-400">Falha ao enviar. Verifique as configurações VAPID no Supabase.</p>
                )}
              </>
            )}
            {testPushMsg === 'not-subscribed' && (
              <p className="text-xs text-amber-400">Push não está ativo neste dispositivo. Ative primeiro na aba Acesso &amp; segurança.</p>
            )}
          </div>
        </Section>
      )}

      {aba === 'conta' && (
      <>
      {/* Conta — info da sessão */}
      <Section title="Conta">
        <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
          <dt className="text-slate-400">Papel</dt>
          <dd className="text-slate-100">{roleLabel(perfil.role)}</dd>

          {condoNome && (
            <>
              <dt className="text-slate-400">Condomínio</dt>
              <dd className="text-slate-100">{condoNome}</dd>
            </>
          )}

          <dt className="text-slate-400">Conta criada</dt>
          <dd className="text-slate-100">
            {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}
          </dd>

          {user.last_sign_in_at && (
            <>
              <dt className="text-slate-400">Último acesso</dt>
              <dd className="text-slate-100">
                {new Date(user.last_sign_in_at).toLocaleString('pt-BR')}
              </dd>
            </>
          )}

          <dt className="text-slate-400">ID</dt>
          <dd className="text-[11px] font-mono text-slate-500">{user.id}</dd>
        </dl>
      </Section>

      {/* ============================================================ */}
      {/* Aviso: morador sem unidade */}
      {/* ============================================================ */}
      {perfil.role === 'morador' && (!pessoa || !pessoa.unidade_id) && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="font-semibold mb-1">⚠ Você ainda não está vinculado a uma unidade.</div>
          <div className="text-amber-100/90">
            Perfis de morador precisam estar associados a uma unidade do condomínio. Procure a administração e peça pra vincular seu cadastro à sua unidade.
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Vínculo com unidade (se houver pessoa) */}
      {/* ============================================================ */}
      {pessoa && (
        <Section
          title="Vínculo com o condomínio"
          hint="Dados de morador. Pra alterar, fale com a administração."
        >
          <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
            <dt className="text-slate-400">Vínculo</dt>
            <dd className="text-slate-100">
              {pessoa.tipo_vinculo}
              {pessoa.relacao_unidade && ` · ${pessoa.relacao_unidade}`}
            </dd>

            {pessoa.cpf && (
              <>
                <dt className="text-slate-400">CPF</dt>
                <dd className="text-slate-100">{pessoa.cpf}</dd>
              </>
            )}

            {pessoa.data_nascimento && (
              <>
                <dt className="text-slate-400">Nascimento</dt>
                <dd className="text-slate-100">
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
            className="px-4 py-2 rounded-md bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700 transition"
          >
            📥 Baixar meus dados
          </button>
          <Button type="button" variant="danger" onClick={solicitarExclusao}>
            🗑 Solicitar exclusão da conta
          </Button>
        </div>
      </Section>
      </>
      )}

      {/* Background removal preview modal */}
      {assinaturaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-sm font-semibold text-slate-100 mb-1">Confirmar assinatura</h4>
            <p className="text-xs text-slate-400 mb-4">
              O fundo branco foi removido automaticamente. Confira antes de salvar.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Original</p>
                <div className="rounded-lg border border-slate-700 bg-white p-2 h-24 flex items-center justify-center">
                  <img src={assinaturaPreview.original} alt="original" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Sem fundo</p>
                <div
                  className="rounded-lg border border-slate-700 h-24 flex items-center justify-center"
                  style={{ background: 'repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 0 0 / 12px 12px' }}
                >
                  <img src={assinaturaPreview.processed} alt="processada" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelAssinaturaPreview}
                className="flex-1 py-2 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAssinaturaPreview}
                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition"
              >
                Usar sem fundo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// UI helpers
// ============================================================

const inputCls =
  'w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 text-sm text-slate-100'

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
    <section className="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
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
      <span className="block text-sm font-medium text-slate-300 mb-1">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
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

