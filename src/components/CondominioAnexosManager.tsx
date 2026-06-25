import { useEffect, useRef, useState } from 'react'
import {
  createAnexo,
  deleteAnexo,
  listAnexos,
  processarAnexoIa,
  renomearAnexo,
  toggleAnexoAtivo,
  type CondominioAnexo,
  type TipoAnexo,
} from '../lib/condominioAnexos'
import DeleteButton from './ui/DeleteButton'
import Button from './ui/Button'
import { useConfirm } from './ui/ConfirmProvider'
import { usePrompt } from './ui/PromptProvider'
import Pill from './ui/Pill'
import { TextInput } from './ui/Input'

interface Props {
  condominio_id: string
  tipo: TipoAnexo
  titulo: string
  emoji: string
  descricao: string
}

const MAX_BYTES = 8 * 1024 * 1024

export default function CondominioAnexosManager({
  condominio_id,
  tipo,
  titulo,
  emoji,
  descricao,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const confirm = useConfirm()
  const prompt = usePrompt()
  const [anexos, setAnexos] = useState<CondominioAnexo[]>([])
  const [loading, setLoading] = useState(true)
  const [novoNome, setNovoNome] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processandoIds, setProcessandoIds] = useState<Set<string>>(new Set())

  async function reload() {
    setLoading(true)
    try {
      const data = await listAnexos(condominio_id, tipo)
      setAnexos(data)
      // Retry automático em background pra anexos ativos sem processado_em
      const pendentes = data.filter((a) => a.ativo && !a.processado_em)
      for (const p of pendentes) {
        processarSilenciosamente(p.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao listar.')
    } finally {
      setLoading(false)
    }
  }

  async function processarSilenciosamente(anexo_id: string) {
    if (processandoIds.has(anexo_id)) return
    setProcessandoIds((s) => new Set(s).add(anexo_id))
    try {
      const res = await processarAnexoIa(anexo_id)
      if (!res.ok) {
        console.warn('[anexo] processamento falhou:', res.error)
      }
      // Atualiza só esse anexo em vez de recarregar lista toda
      const novos = await listAnexos(condominio_id, tipo)
      setAnexos(novos)
    } catch (e) {
      console.warn('[anexo] erro silencioso:', e)
    } finally {
      setProcessandoIds((s) => {
        const next = new Set(s)
        next.delete(anexo_id)
        return next
      })
    }
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [condominio_id, tipo])

  async function handleFile(file: File | null) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Aceita apenas arquivo PDF.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`Arquivo muito grande. Máximo ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`)
      return
    }
    const nome = novoNome.trim() || file.name.replace(/\.pdf$/i, '')
    setUploading(true); setError(null)
    try {
      const novo = await createAnexo({ condominio_id, tipo, nome, file })
      setNovoNome('')
      await reload()
      // processarSilenciosamente já será chamado pelo reload (anexo novo sem processado_em)
      processarSilenciosamente(novo.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRenomear(a: CondominioAnexo) {
    const novo = await prompt({ title: 'Renomear anexo', placeholder: 'Nome do arquivo', defaultValue: a.nome })
    if (!novo || novo.trim() === a.nome) return
    try { await renomearAnexo(a.id, novo); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro.') }
  }

  async function handleToggleAtivo(a: CondominioAnexo) {
    try { await toggleAnexoAtivo(a.id, !a.ativo); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro.') }
  }

  async function handleApagar(a: CondominioAnexo) {
    const ok = await confirm({
      title: 'Apagar anexo',
      message: `Apagar "${a.nome}" DEFINITIVAMENTE?`,
      tone: 'danger',
      confirmText: 'Apagar',
    })
    if (!ok) return
    try { await deleteAnexo(a); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro.') }
  }

  return (
    <fieldset className="border border-slate-700 rounded-md p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold text-slate-200">
        {emoji} {titulo}
      </legend>
      <p className="text-xs text-slate-400 -mt-2">{descricao}</p>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder='Nome do anexo (ex.: "Convenção 2024")'
          maxLength={80}
          className="flex-1 min-w-[200px]"
        />
        <Button type="button" onClick={() => inputRef.current?.click()} loading={uploading}>
          + Anexar PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-xs text-slate-500">Carregando anexos...</div>
      ) : anexos.length === 0 ? (
        <div className="text-xs text-slate-500 italic py-2">Nenhum anexo ainda. Suba o primeiro PDF acima.</div>
      ) : (
        <ul className="divide-y divide-slate-800">
          {anexos.map((a) => (
            <li key={a.id} className={`py-3 ${a.ativo ? '' : 'opacity-50'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-slate-100 hover:text-brand-400 hover:underline truncate"
                    >
                      📄 {a.nome}
                    </a>
                    {!a.ativo && (
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">Inativo</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Adicionado em {new Date(a.created_at).toLocaleDateString('pt-BR')}
                    {a.processado_em && ` · processado em ${new Date(a.processado_em).toLocaleDateString('pt-BR')}`}
                    {a.artigos_extraidos != null && ` · ${a.artigos_extraidos} artigos extraídos`}
                    {a.texto_extraido && ` · ${a.texto_extraido.length} caracteres salvos`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {processandoIds.has(a.id) && (
                    <Pill tone="success" dot>processando</Pill>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleRenomear(a)}>
                    Renomear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleAtivo(a)}
                    title={a.ativo ? 'Desativar (não usar na IA)' : 'Reativar'}
                  >
                    {a.ativo ? 'Desativar' : 'Reativar'}
                  </Button>
                  <DeleteButton label="" onClick={() => handleApagar(a)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
