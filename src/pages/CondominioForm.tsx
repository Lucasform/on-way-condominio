import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  createCondominio,
  deleteCondominio,
  getCondominio,
  updateCondominio,
} from '../lib/condominios'
import type { CondominioInput, Plano } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { Field, TextInput, Select } from '../components/ui/Input'
import ConvitesPanel from '../components/ConvitesPanel'
import LogoUpload from '../components/LogoUpload'
import PessoasImport from '../components/PessoasImport'
import UnidadesImport from '../components/UnidadesImport'
import FornecedoresImport from '../components/FornecedoresImport'
import CondominioAnexoPdf from '../components/CondominioAnexoPdf'
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
  plano: 'free',
}

export default function CondominioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const isNew = !id || id === 'novo'
  // Apenas admin_onway pode excluir um condomínio (efeito em cascata pesado)
  const canDelete = !isNew && perfil?.role === 'admin_onway'

  const [form, setForm] = useState<CondominioInput>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!id) return
    const nomeAlvo = form.nome || 'esse condomínio'
    const conf = window.prompt(
      `Excluir "${nomeAlvo}" DEFINITIVAMENTE remove todos os dados associados (unidades, pessoas, multas, ocorrências, mural, calendário, chat, etc).\n\nEsta ação é irreversível.\n\nDigite EXCLUIR para confirmar:`,
    )
    if (conf !== 'EXCLUIR') return
    setDeleting(true)
    setError(null)
    try {
      await deleteCondominio(id)
      navigate('/condominios')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir.')
      setDeleting(false)
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
            plano: c.plano,
          })
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
    return <div className="px-8 py-10 text-slate-400">Carregando...</div>
  }

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        title={isNew ? 'Novo condomínio' : 'Editar condomínio'}
        subtitle={isNew ? 'Cadastre um novo condomínio na plataforma.' : 'Atualize os dados.'}
        actions={
          <div className="flex items-center gap-2">
            {canDelete && (
              <DeleteButton onClick={handleDelete} disabled={deleting} />
            )}
            <Link to="/condominios">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
        }
      />

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

        <Field label="Plano">
          <Select
            value={form.plano}
            onChange={(e) => update('plano', e.target.value as Plano)}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </Select>
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

            <div className="grid grid-cols-2 gap-4">
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
                  A IA usa esse conteúdo pra sugerir multas em ocorrências.
                </p>
                <span className="text-xs text-brand-400 mt-2 inline-block">Gerenciar artigos →</span>
              </Link>

              <Link
                to={`/whatsapp-config`}
                className="block rounded-lg border border-slate-700 p-4 bg-slate-900/40 hover:border-brand-500/60 transition"
              >
                <div className="text-sm font-semibold text-slate-100">💬 WhatsApp</div>
                <p className="text-xs text-slate-400 mt-1">
                  Configurar provider Z-API ou Evolution pra envio automático.
                </p>
                <span className="text-xs text-brand-400 mt-2 inline-block">Configurar →</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <CondominioAnexoPdf
                condominio_id={id}
                campo="regimento_pdf_url"
                subpasta="regimento"
                titulo="Anexar regimento (PDF)"
                emoji="📑"
                descricao="Suba o PDF oficial do regimento interno."
                current={form.regimento_pdf_url}
                onChange={(url) => update('regimento_pdf_url', url)}
                hint="Por enquanto só guarda o PDF. Extração automática de artigos e embeddings pra IA virá em update futuro."
              />
              <CondominioAnexoPdf
                condominio_id={id}
                campo="modelo_notificacao_url"
                subpasta="modelo-notificacao"
                titulo="Modelo de notificação (PDF)"
                emoji="📄"
                descricao="Anexe um modelo PDF de notificação/multa no padrão do seu condomínio."
                current={form.modelo_notificacao_url}
                onChange={(url) => update('modelo_notificacao_url', url)}
                hint="Por enquanto só guarda o modelo. Substituição do template padrão no Gerar PDF da multa virá em update futuro."
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* 3) IMPORTAÇÕES EM MASSA */}
          {/* ============================================================ */}
          <div className="mt-10">
            <h2 className="text-base font-semibold text-slate-200 mb-1">
              Importações em massa
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Suba planilhas (XLSX/CSV). Os dados são normalizados (CPF/telefone só dígitos, valor com vírgula vira número) e validados antes de inserir.
            </p>

            <div className="space-y-4">
              <UnidadesImport condominio_id={id} />
              <PessoasImport condominio_id={id} />
              <FornecedoresImport condominio_id={id} />
            </div>
          </div>

          {/* ============================================================ */}
          {/* 4) CONVITES */}
          {/* ============================================================ */}
          <div className="mt-10">
            <ConvitesPanel condominio_id={id} />
          </div>
        </>
      )}
    </div>
  )
}
