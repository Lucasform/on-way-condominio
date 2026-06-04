import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  createCondominio,
  deleteCondominio,
  setCondominioAtivo,
  getCondominio,
  updateCondominio,
} from '../lib/condominios'
import type { CondominioInput } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import ConfirmarExclusaoCondominio from '../components/ConfirmarExclusaoCondominio'
import { Field, TextInput, TextArea } from '../components/ui/Input'
import ConvitesPanel from '../components/ConvitesPanel'
import LogoUpload from '../components/LogoUpload'
import LoginBgUpload from '../components/LoginBgUpload'
import { supabase } from '../lib/supabase'
import BrandPreview from '../components/BrandPreview'
import CondominioAnexosManager from '../components/CondominioAnexosManager'
import CondominioDiretoria from '../components/CondominioDiretoria'
import CondominioMandatos from '../components/CondominioMandatos'
import VincularUserAoCondo from '../components/VincularUserAoCondo'
import AgenteTreinamento from '../components/AgenteTreinamento'
import { traduzErro } from '../lib/errorMessages'

const EMPTY: CondominioInput = {
  nome: '',
  cnpj: null,
  endereco: null,
  bairro: null,
  cidade: null,
  estado: null,
  cep: null,
  administradora: null,
  logo_url: null,
  regimento_pdf_url: null,
  modelo_notificacao_url: null,
  modelo_notificacao_texto: null,
  ai_instrucoes: null,
  slug: null,
  cor_primaria: null,
  texto_login: null,
  imagem_login_url: null,
  permite_signup: true,
  mensagem_boas_vindas: null,
  plano: 'free',
}

export default function CondominioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isNew = !id || id === 'novo'
  const isAdmin = perfil?.role === 'admin_onway'
  const isSindico = ['administradora', 'sindico', 'subsindico'].includes(perfil?.role ?? '')

  const [form, setForm] = useState<CondominioInput>(EMPTY)
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [arquivando, setArquivando] = useState(false)
  const [showExcluirModal, setShowExcluirModal] = useState(false)
  const [brandSaving, setBrandSaving] = useState(false)
  const [brandSavedAt, setBrandSavedAt] = useState<number | null>(null)

  async function handleArquivar() {
    if (!id) return
    const ok = await confirm({
      title: 'Arquivar condomínio',
      message: `Arquivar "${form.nome}"? O condomínio fica oculto da operação mas os dados ficam preservados. O administrador OnWay pode restaurar ou excluir definitivamente depois.`,
      tone: 'danger',
      confirmText: 'Arquivar',
    })
    if (!ok) return
    setArquivando(true)
    try {
      await setCondominioAtivo(id, false)
      setAtivo(false)
      toast.success('Condomínio arquivado.')
    } catch (e) {
      toast.error('Erro ao arquivar', e instanceof Error ? e.message : '')
    } finally {
      setArquivando(false)
    }
  }

  async function handleRestaurar() {
    if (!id) return
    setArquivando(true)
    try {
      await setCondominioAtivo(id, true)
      setAtivo(true)
      toast.success('Condomínio restaurado.')
    } catch (e) {
      toast.error('Erro ao restaurar', e instanceof Error ? e.message : '')
    } finally {
      setArquivando(false)
    }
  }

  async function handleExcluirDefinitivo() {
    if (!id) return
    setDeleting(true)
    setError(null)
    try {
      const r = await deleteCondominio(id)
      toast.success(`Excluído. ${r.users} usuários removidos.`)
      navigate('/condominios')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir.')
      setDeleting(false)
      setShowExcluirModal(false)
    }
  }

  useEffect(() => {
    if (isNew) return
    let mounted = true
    ;(async () => {
      try {
        const c = await getCondominio(id!)
        if (!mounted) return
        if (!c) {
          setError('Condomínio não encontrado.')
        } else {
          setForm({
            nome: c.nome,
            cnpj: c.cnpj,
            endereco: c.endereco,
            bairro: c.bairro,
            cidade: c.cidade,
            estado: c.estado,
            cep: c.cep,
            administradora: c.administradora,
            logo_url: c.logo_url,
            regimento_pdf_url: c.regimento_pdf_url,
            modelo_notificacao_url: c.modelo_notificacao_url,
            modelo_notificacao_texto: c.modelo_notificacao_texto,
            ai_instrucoes: c.ai_instrucoes,
            slug: c.slug,
            cor_primaria: c.cor_primaria,
            texto_login: c.texto_login,
            imagem_login_url: c.imagem_login_url,
            permite_signup: c.permite_signup,
            mensagem_boas_vindas: c.mensagem_boas_vindas,
            plano: c.plano,
          })
          setAtivo(c.ativo)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id, isNew])

  function update<K extends keyof CondominioInput>(key: K, value: CondominioInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Auto-save dos campos da Identidade Visual com debounce 700ms. Não dispara
  // no primeiro mount (depende de form.nome ter sido populado pela load).
  useEffect(() => {
    if (isNew || !id || loading) return
    const t = setTimeout(async () => {
      setBrandSaving(true)
      try {
        const { error } = await supabase
          .from('condominios')
          .update({
            slug: form.slug?.trim() || null,
            cor_primaria: form.cor_primaria?.trim() || null,
            texto_login: form.texto_login?.trim() || null,
            mensagem_boas_vindas: form.mensagem_boas_vindas?.trim() || null,
            permite_signup: form.permite_signup ?? true,
          })
          .eq('id', id)
        if (error) throw error
        setBrandSavedAt(Date.now())
      } catch (e) {
        console.warn('[brand auto-save] falhou:', e)
      } finally {
        setBrandSaving(false)
      }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.slug,
    form.cor_primaria,
    form.texto_login,
    form.mensagem_boas_vindas,
    form.permite_signup,
  ])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const c = await createCondominio(form)
        navigate(`/condominios/${c.id}`, { replace: true })
      } else {
        await updateCondominio(id!, form)
        navigate('/condominios')
      }
    } catch (e) {
      setError(traduzErro(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="px-4 py-6 sm:px-8 sm:py-10 text-slate-400">Carregando...</div>
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title={isNew ? 'Novo condomínio' : 'Editar condomínio'}
        subtitle={isNew ? 'Cadastre um novo condomínio na plataforma.' : 'Atualize os dados.'}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && ativo && isSindico && !isAdmin && (
              <Button variant="secondary" size="sm" onClick={handleArquivar} loading={arquivando}>
                📦 Arquivar
              </Button>
            )}
            {!isNew && ativo && isAdmin && (
              <>
                <Button variant="secondary" size="sm" onClick={handleArquivar} loading={arquivando}>
                  📦 Arquivar
                </Button>
                <Button variant="danger" size="sm" onClick={() => setShowExcluirModal(true)}>
                  Excluir definitivamente
                </Button>
              </>
            )}
            {!isNew && !ativo && isAdmin && (
              <>
                <Button variant="secondary" size="sm" onClick={handleRestaurar} loading={arquivando}>
                  ↻ Restaurar
                </Button>
                <Button variant="danger" size="sm" onClick={() => setShowExcluirModal(true)}>
                  Excluir definitivamente
                </Button>
              </>
            )}
            <Link to="/condominios">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
        }
      />

      {!isNew && !ativo && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-3">
          <span className="text-base leading-none">📦</span>
          <div>
            <div className="font-medium">Este condomínio está arquivado.</div>
            <div className="text-xs text-amber-200/80 mt-0.5">
              Dados preservados, mas o condomínio fica oculto da operação.
              {isAdmin && ' Você pode restaurar ou excluir definitivamente nos botões acima.'}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1) FOTO DO CONDOMÍNIO — primeira coisa */}
      {/* ============================================================ */}
      {!isNew && id && (
        <fieldset className="mb-8 border border-slate-700 rounded-md p-4 space-y-4">
          <legend className="px-2 text-sm font-semibold text-slate-200">
            Foto do condomínio
          </legend>
          <p className="text-xs text-slate-400 -mt-2">
            Aparece no header do app pros moradores e no cabeçalho do PDF de notificação/multa.
          </p>
          <LogoUpload
            condominio_id={id}
            current={form.logo_url}
            onChange={(url) => update('logo_url', url)}
          />
        </fieldset>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Nome" required>
          <TextInput
            required
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
          />
        </Field>

        <Field label="CNPJ" hint="14 dígitos, sem máscara">
          <TextInput
            value={form.cnpj ?? ''}
            onChange={(e) => update('cnpj', e.target.value)}
          />
        </Field>

        <Field label="Administradora">
          <TextInput
            value={form.administradora ?? ''}
            onChange={(e) => update('administradora', e.target.value)}
          />
        </Field>

        <fieldset className="border-t border-slate-800 pt-5">
          <legend className="text-sm font-semibold text-slate-300 mb-3 px-2 -ml-2">Endereço</legend>

          <div className="space-y-5">
            <Field label="Logradouro">
              <TextInput
                value={form.endereco ?? ''}
                onChange={(e) => update('endereco', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Bairro">
                <TextInput
                  value={form.bairro ?? ''}
                  onChange={(e) => update('bairro', e.target.value)}
                />
              </Field>
              <Field label="CEP" hint="8 dígitos, sem máscara">
                <TextInput
                  value={form.cep ?? ''}
                  onChange={(e) => update('cep', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-4">
              <Field label="Cidade">
                <TextInput
                  value={form.cidade ?? ''}
                  onChange={(e) => update('cidade', e.target.value)}
                />
              </Field>
              <Field label="UF">
                <TextInput
                  maxLength={2}
                  value={form.estado ?? ''}
                  onChange={(e) => update('estado', e.target.value.toUpperCase())}
                />
              </Field>
            </div>
          </div>
        </fieldset>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </Button>
          <Link to="/condominios">
            <Button variant="secondary" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>

      {!isNew && id && (
        <>
          {/* ============================================================ */}
          {/* 2) CONFIGURAÇÕES (sem auditoria) */}
          {/* ============================================================ */}
          <div className="mt-10">
            <h2 className="text-base font-semibold text-slate-200 mb-3">
              Configurações do condomínio
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                to={`/regimento`}
                className="block rounded-lg border border-slate-700 p-4 bg-slate-900/40 hover:border-brand-500/60 transition"
              >
                <div className="text-sm font-semibold text-slate-100">📜 Regimento interno</div>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre artigos manualmente ou anexe o PDF do regimento.
                  O agente utiliza para as análises.
                </p>
                <span className="text-xs text-brand-400 mt-2 inline-block">Gerenciar artigos →</span>
              </Link>

              <Link
                to={`/whatsapp-config`}
                className="block rounded-lg border border-slate-700 p-4 bg-slate-900/40 hover:border-brand-500/60 transition"
              >
                <div className="text-sm font-semibold text-slate-100">💬 WhatsApp</div>
                <p className="text-xs text-slate-400 mt-1">
                  Configurar o WhatsApp business.
                </p>
                <span className="text-xs text-brand-400 mt-2 inline-block">Configurar →</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 mt-3">
              <CondominioAnexosManager
                condominio_id={id}
                tipo="regimento"
                titulo="Regimento interno"
                emoji="📑"
                descricao="Anexe um ou mais PDFs de regimento (convenção, regulamento interno, normas de áreas comuns). Artigos serão gerados automaticamente."
              />
              <CondominioAnexosManager
                condominio_id={id}
                tipo="modelo_notificacao"
                titulo="Modelos de notificação"
                emoji="📄"
                descricao="Anexe modelos de notificação/advertência usados pelo condomínio. Padrão que será usado na emissão."
              />
              <CondominioAnexosManager
                condominio_id={id}
                tipo="modelo_multa"
                titulo="Modelos de multa"
                emoji="💰"
                descricao="Anexe modelos PDF de multa formal. Padrão que será usado na emissão."
              />
              <CondominioAnexosManager
                condominio_id={id}
                tipo="modelo_comunicado"
                titulo="Modelos de comunicado"
                emoji="📣"
                descricao="Anexe modelos PDF de comunicados (aviso de manutenção, festa, regra nova). O agente IA segue o tom e a estrutura desses modelos ao gerar comunicados novos."
              />
            </div>

            <div className="mt-3">
              <AgenteTreinamento
                condominio_id={id}
                current={form.ai_instrucoes}
                onChange={(v) => update('ai_instrucoes', v)}
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* 2.5) IDENTIDADE VISUAL (white-label) */}
          {/* ============================================================ */}
          <fieldset className="mt-10 border border-slate-700 rounded-md p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold text-slate-200 flex items-center gap-2">
              Identidade visual (área de acesso)
              {brandSaving && <span className="text-xs text-sky-300 font-normal">Salvando…</span>}
              {!brandSaving && brandSavedAt && Date.now() - brandSavedAt < 3000 && (
                <span className="text-xs text-emerald-300 font-normal">✓ Salvo</span>
              )}
            </legend>
            <p className="text-xs text-slate-400 -mt-2">
              Personaliza a tela de login pros moradores acessarem por subdomínio próprio (ex.:{' '}
              <code className="text-slate-300">jardim-paulista.onwaytech.com.br</code>) ou por link path{' '}
              (<code className="text-slate-300">/c/jardim-paulista</code>).
            </p>

            <Field
              label="Slug do condomínio"
              hint="Letras minúsculas, números e hífen. Usado como subdomínio e como link. Não usar acentos ou espaços."
            >
              <TextInput
                value={form.slug ?? ''}
                onChange={(e) =>
                  update(
                    'slug',
                    e.target.value
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[̀-ͯ]/g, '')
                      .replace(/[^a-z0-9-]/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-|-$/g, '') || null,
                  )
                }
                placeholder="ex.: jardim-paulista"
              />
            </Field>

            <Field label="Cor primária" hint="A partir dela geramos toda a paleta usada no app (botões, header, links).">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.cor_primaria ?? '#1D4ED8'}
                  onChange={(e) => update('cor_primaria', e.target.value)}
                  className="h-9 w-12 rounded border border-slate-700 bg-slate-900 cursor-pointer"
                />
                <TextInput
                  value={form.cor_primaria ?? ''}
                  onChange={(e) => update('cor_primaria', e.target.value || null)}
                  placeholder="#1D4ED8"
                  className="flex-1"
                />
              </div>
            </Field>

            <BrandPreview
              cor={form.cor_primaria}
              nome={form.nome}
              logoUrl={form.logo_url}
            />

            <Field label="Mensagem de boas-vindas" hint="Aparece abaixo do título na tela de escolha de perfil. Mantenha curto.">
              <TextInput
                value={form.mensagem_boas_vindas ?? ''}
                onChange={(e) => update('mensagem_boas_vindas', e.target.value || null)}
                placeholder="Ex.: Acesse a sua conta do condomínio."
                maxLength={140}
              />
            </Field>

            <Field label="Texto na tela de login" hint="Subtítulo personalizado da tela de login. Opcional.">
              <TextArea
                value={form.texto_login ?? ''}
                onChange={(e) => update('texto_login', e.target.value || null)}
                rows={2}
                placeholder="Ex.: Bem-vindo ao portal do Condomínio Jardim Paulista."
                maxLength={280}
              />
            </Field>

            {id && (
              <Field label="Imagem de fundo">
                <LoginBgUpload
                  condominio_id={id}
                  current={form.imagem_login_url}
                  onChange={(url) => update('imagem_login_url', url)}
                />
              </Field>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={form.permite_signup ?? true}
                onChange={(e) => update('permite_signup', e.target.checked)}
              />
              <span>
                Permitir auto-cadastro via código de convite{' '}
                <span className="text-slate-500 text-xs">
                  (desligue se a administração quiser criar todas as contas manualmente)
                </span>
              </span>
            </label>
          </fieldset>

          {/* ============================================================ */}
          {/* 3) DIRETORIA */}
          {/* ============================================================ */}
          <div className="mt-10 space-y-6">
            <CondominioDiretoria condominio_id={id} />
            <CondominioMandatos condominio_id={id} />
            <VincularUserAoCondo
              condominio_id={id}
              condominio_nome={form.nome}
            />
          </div>

          {/* ============================================================ */}
          {/* 4) CONVITES */}
          {/* ============================================================ */}
          <div className="mt-10">
            <ConvitesPanel condominio_id={id} />
          </div>
        </>
      )}

      {id && (
        <ConfirmarExclusaoCondominio
          open={showExcluirModal}
          onClose={() => setShowExcluirModal(false)}
          onConfirm={handleExcluirDefinitivo}
          condominioId={id}
          condominioNome={form.nome || 'esse condomínio'}
          loading={deleting}
        />
      )}
    </div>
  )
}
