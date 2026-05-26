import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../components/AuthProvider'
import { listCondominios } from '../lib/condominios'
import {
  getWhatsappConfig,
  upsertWhatsappConfig,
  buildWebhookUrl,
  sendWhatsApp,
} from '../lib/whatsapp'
import type { Condominio } from '../types/condominio'
import type { WhatsappConfigInput, WhatsappProvider } from '../types/whatsapp'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, Select } from '../components/ui/Input'

const EMPTY: WhatsappConfigInput = {
  condominio_id: '',
  provider: 'z-api',
  api_url: 'https://api.z-api.io',
  instance_id: '',
  api_token: '',
  numero_envio: '',
  ativo: false,
}

export default function WhatsappConfig() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway'

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string>('')
  const [form, setForm] = useState<WhatsappConfigInput>(EMPTY)
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [testando, setTestando] = useState(false)
  const [testNumero, setTestNumero] = useState('')

  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => {
          setCondos(cs)
          if (cs.length && !scopeId) setScopeId(cs[0].id)
          else if (!cs.length) setLoading(false)
        })
        .catch(() => setLoading(false))
    } else if (perfil?.condominio_id) {
      setScopeId(perfil.condominio_id)
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, perfil])

  useEffect(() => {
    if (!scopeId) return
    setLoading(true)
    setWebhookSecret(null)
    getWhatsappConfig(scopeId)
      .then((c) => {
        if (c) {
          setForm({
            condominio_id: c.condominio_id,
            provider: c.provider,
            api_url: c.api_url ?? '',
            instance_id: c.instance_id ?? '',
            api_token: c.api_token ?? '',
            numero_envio: c.numero_envio ?? '',
            ativo: c.ativo,
          })
          setWebhookSecret(c.webhook_secret)
        } else {
          setForm({ ...EMPTY, condominio_id: scopeId })
          setWebhookSecret(null)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro.'))
      .finally(() => setLoading(false))
  }, [scopeId])

  function update<K extends keyof WhatsappConfigInput>(key: K, value: WhatsappConfigInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.condominio_id) return
    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      const c = await upsertWhatsappConfig(form)
      setWebhookSecret(c.webhook_secret)
      setOkMsg('Configuração salva.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!form.condominio_id || !testNumero) return
    setTestando(true)
    setOkMsg(null)
    setError(null)
    try {
      const r = await sendWhatsApp({
        condominio_id: form.condominio_id,
        telefone: testNumero,
        texto: '🧪 Mensagem de teste do OnWay Condomínio. Se você está lendo isso, a integração está funcionando!',
      })
      if (r.ok) setOkMsg('✓ Enviado! Veja se chegou no número.')
      else if (r.skipped) setError('Configuração inativa ou incompleta.')
      else setError('Falha no envio. Veja log do provider.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setTestando(false)
    }
  }

  if (loading) return <div className="px-8 py-10 text-slate-400">Carregando...</div>

  const webhookUrl = webhookSecret ? buildWebhookUrl(webhookSecret) : null

  return (
    <div className="px-8 py-10 max-w-3xl">
      <PageHeader
        title="WhatsApp"
        subtitle="Integração via Z-API ou Evolution API (não-oficial). Conecte o WhatsApp do condomínio pra receber e enviar mensagens dos moradores direto pelo app deles."
      />

      <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
        ⚠ <strong>Importante:</strong> APIs não-oficiais (Z-API, Evolution) violam ToS do WhatsApp.
        Há risco de banimento do número, especialmente em envio massivo. Use com moderação.
      </div>

      {isAdmin && condos.length > 0 && (
        <div className="mb-5 max-w-xs">
          <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
          <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
            {condos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Provider" required>
          <Select
            value={form.provider}
            onChange={(e) => update('provider', e.target.value as WhatsappProvider)}
          >
            <option value="z-api">Z-API (z-api.io)</option>
            <option value="evolution">Evolution API (self-hosted)</option>
          </Select>
        </Field>

        <Field
          label="URL base da API"
          required
          hint={form.provider === 'z-api' ? 'Geralmente https://api.z-api.io' : 'Ex: https://evolution.seuserver.com'}
        >
          <TextInput
            required
            value={form.api_url}
            onChange={(e) => update('api_url', e.target.value)}
          />
        </Field>

        <Field
          label={form.provider === 'z-api' ? 'Instance ID' : 'Instance name'}
          required
        >
          <TextInput
            required
            value={form.instance_id}
            onChange={(e) => update('instance_id', e.target.value)}
            className="font-mono"
          />
        </Field>

        <Field
          label={form.provider === 'z-api' ? 'Token' : 'API Key'}
          required
          hint="Será armazenado encriptado pelo Supabase + RLS (só admin/sindico veem)."
        >
          <TextInput
            type="password"
            required
            value={form.api_token}
            onChange={(e) => update('api_token', e.target.value)}
            className="font-mono"
          />
        </Field>

        <Field
          label="Número WhatsApp do condomínio"
          hint="Apenas dígitos com DDI. Ex: 5511999999999"
        >
          <TextInput
            value={form.numero_envio}
            onChange={(e) => update('numero_envio', e.target.value)}
            className="font-mono"
            placeholder="5511999999999"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => update('ativo', e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-emerald-500"
          />
          Ativar envio/recebimento WhatsApp neste condomínio
        </label>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        {okMsg && (
          <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
            {okMsg}
          </div>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </form>

      {/* Webhook URL e teste — só aparecem depois de salvar */}
      {webhookUrl && (
        <>
          <div className="mt-8 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5">
            <div className="text-sm font-medium text-sky-200 mb-1">🪝 URL do Webhook</div>
            <p className="text-xs text-slate-400 mb-3">
              Cola essa URL no painel do{' '}
              {form.provider === 'z-api' ? 'Z-API (Webhooks → Ao receber)' : 'Evolution (Settings → Webhook)'}.
              Quando o morador escrever no WhatsApp, o provider chama este endpoint.
            </p>
            <code className="block bg-slate-950 border border-slate-700 rounded p-2 text-xs text-emerald-300 font-mono break-all">
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              className="mt-2 text-xs text-sky-300 hover:underline"
            >
              📋 Copiar
            </button>
          </div>

          {form.ativo && (
            <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="text-sm font-medium text-emerald-200 mb-1">🧪 Testar envio</div>
              <p className="text-xs text-slate-400 mb-3">
                Manda uma mensagem teste pra um número. Verifique se chega no WhatsApp.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={testNumero}
                  onChange={(e) => setTestNumero(e.target.value)}
                  placeholder="5511999999999"
                  className="flex-1 px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100"
                />
                <Button onClick={handleTest} disabled={testando || !testNumero}>
                  {testando ? '...' : 'Enviar teste'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-8 text-xs text-slate-600 space-y-1">
        <p>
          <strong>Status:</strong>{' '}
          {form.ativo
            ? '🟢 WhatsApp habilitado pra este condomínio. Mensagens de multa, encomenda e chat irão também via WhatsApp.'
            : '⚪ WhatsApp inativo. App funciona normal sem ele.'}
        </p>
        <p>
          <strong>Status do projeto:</strong> Toda a estrutura está pronta. Quando você criar conta no Z-API/Evolution
          e preencher acima, começa a funcionar imediatamente. Antes disso, o app continua 100% funcional
          (e-mail + push + chat interno).
        </p>
      </div>
    </div>
  )
}
