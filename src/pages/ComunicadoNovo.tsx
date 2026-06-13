import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { createComunicado, gerarComunicadoIA } from '../lib/comunicados'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, TextArea } from '../components/ui/Input'

export default function ComunicadoNovo() {
  const navigate = useNavigate()
  const { perfil } = useAuth()

  const [condominioId, setCondominioId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tituloSugerido, setTituloSugerido] = useState('')

  const [tituloIA, setTituloIA] = useState('')
  const [corpoIA, setCorpoIA] = useState('')
  const [iaModelo, setIaModelo] = useState<string | null>(null)
  const [modeloAnexoId, setModeloAnexoId] = useState<string | null>(null)

  const [gerando, setGerando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (perfil?.condominio_id) setCondominioId(perfil.condominio_id)
  }, [perfil])

  async function handleGerar() {
    setError(null)
    if (!condominioId) return setError('Condomínio não identificado.')
    if (!descricao.trim()) return setError('Informe a descrição do que deve ser comunicado.')
    setGerando(true)
    try {
      const r = await gerarComunicadoIA({
        condominio_id: condominioId,
        descricao,
        titulo_sugerido: tituloSugerido.trim() || undefined,
      })
      setTituloIA(r.titulo)
      setCorpoIA(r.corpo)
      setIaModelo(r.ia_modelo)
      setModeloAnexoId(r.modelo_anexo_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na IA.')
    } finally {
      setGerando(false)
    }
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault()
    if (!tituloIA.trim() || !corpoIA.trim()) {
      return setError('Gere o comunicado antes de salvar.')
    }
    setSalvando(true)
    setError(null)
    try {
      const c = await createComunicado({
        condominio_id: condominioId,
        titulo: tituloIA,
        descricao,
        corpo: corpoIA,
        modelo_anexo_id: modeloAnexoId,
        ia_modelo: iaModelo,
      })
      navigate(`/comunicados/${c.id}`)
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Erro ao salvar.')
      setSalvando(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Novo comunicado"
        subtitle="Escreva o que precisa avisar. O agente IA segue o modelo do condomínio e devolve o texto pronto."
        actions={
          <Link to="/comunicados">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <div className="space-y-5">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="text-sm font-medium text-slate-200">1. Sobre o que comunicar</div>
          <Field label="Título sugerido (opcional)">
            <TextInput
              value={tituloSugerido}
              onChange={(e) => setTituloSugerido(e.target.value)}
              placeholder="Ex.: Manutenção da caixa d'água"
              maxLength={120}
            />
          </Field>
          <Field
            label="Descrição"
            hint="Escreva como se estivesse explicando rápido pro vizinho. O agente cuida da formatação."
            required
          >
            <TextArea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              placeholder={'Ex.: vai ter manutenção da caixa d\'água na quinta dia 12, das 8h às 12h. Avisar que vai faltar água nesse período e pedir pra encherem as garrafas antes.'}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={handleGerar} disabled={gerando}>
              {gerando ? 'Gerando...' : '✨ Gerar com o Agente'}
            </Button>
          </div>
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {(tituloIA || corpoIA) && (
          <form
            onSubmit={handleSalvar}
            className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-6 space-y-4"
          >
            <div className="text-sm font-medium text-sky-200">2. Revise e salve</div>
            <Field label="Título">
              <TextInput
                value={tituloIA}
                onChange={(e) => setTituloIA(e.target.value)}
                required
              />
            </Field>
            <Field label="Corpo">
              <TextArea
                value={corpoIA}
                onChange={(e) => setCorpoIA(e.target.value)}
                rows={12}
                required
              />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar como rascunho'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleGerar} disabled={gerando}>
                🔄 Refazer
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              Depois de salvar você pode revisar mais, baixar o PDF padrão e enviar por e-mail aos moradores.
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

