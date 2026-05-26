import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  createCondominio,
  getCondominio,
  updateCondominio,
} from '../lib/condominios'
import type { CondominioInput, Plano } from '../types/condominio'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, Select } from '../components/ui/Input'
import ConvitesPanel from '../components/ConvitesPanel'
import LogoUpload from '../components/LogoUpload'
import PessoasImport from '../components/PessoasImport'
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
  plano: 'free',
}

export default function CondominioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'novo'

  const [form, setForm] = useState<CondominioInput>(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <Link to="/condominios">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

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
          <div className="mt-10">
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Configurações do condomínio
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              <Link
                to={`/regimento`}
                className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 hover:border-brand-500 dark:hover:border-brand-700 transition"
              >
                <div className="text-lg mb-1">📜</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Regimento interno</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cadastre os artigos. A IA usa esse conteúdo pra sugerir multas em ocorrências.
                </p>
                <span className="text-xs text-brand-700 dark:text-brand-400 mt-2 inline-block">Gerenciar artigos →</span>
              </Link>

              <div className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40">
                <div className="text-lg mb-1">📄</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Modelo de notificação</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Usa o modelo padrão do OnWay com o logo deste condomínio. Gere o PDF direto na tela de cada multa.
                </p>
                <span className="text-xs text-slate-500 mt-2 inline-block">Botão "📄 Gerar PDF" em /multas/[id]</span>
              </div>

              <Link
                to={`/whatsapp-config`}
                className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 hover:border-brand-500 dark:hover:border-brand-700 transition"
              >
                <div className="text-lg mb-1">💬</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">WhatsApp</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configurar provider Z-API ou Evolution pra envio automático.
                </p>
                <span className="text-xs text-brand-700 dark:text-brand-400 mt-2 inline-block">Configurar →</span>
              </Link>

              <Link
                to={`/auditoria`}
                className="block rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 hover:border-brand-500 dark:hover:border-brand-700 transition"
              >
                <div className="text-lg mb-1">📋</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Log de auditoria</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Histórico de ações sensíveis: convites, desativações, resets de senha.
                </p>
                <span className="text-xs text-brand-700 dark:text-brand-400 mt-2 inline-block">Ver log →</span>
              </Link>
            </div>
          </div>

          <div className="mt-8">
            <fieldset className="border border-slate-200 dark:border-slate-700 rounded-md p-4 space-y-4">
              <legend className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Logo do condomínio
              </legend>
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
                Aparece no header da app pra moradores do condomínio E no cabeçalho do PDF de multa.
              </p>
              <LogoUpload
                condominio_id={id}
                current={form.logo_url}
                onChange={(url) => update('logo_url', url)}
              />
            </fieldset>
          </div>
          <div className="mt-8">
            <PessoasImport condominio_id={id} />
          </div>
          <div className="mt-8">
            <ConvitesPanel condominio_id={id} />
          </div>
        </>
      )}
    </div>
  )
}
