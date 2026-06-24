import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { extractPdfWithAI, type PdfAiContext, type PdfExtractResult } from '../lib/pdfAi'

interface Props {
  context: PdfAiContext
  onExtracted: (result: PdfExtractResult) => void
  disabled?: boolean
  placeholder?: string
}

const PLACEHOLDERS: Record<PdfAiContext, string> = {
  unidades: 'Ex.: "Este PDF contém as unidades do bloco A. Torre B ainda não está aqui."',
  pessoas: 'Ex.: "São moradores do bloco A. Desconsidere funcionários listados no final."',
  ocorrencia: 'Ex.: "Boletim de ocorrência de barulho excessivo no apartamento 302."',
  comunicado: 'Ex.: "Gere um comunicado formal informando a manutenção do elevador."',
}

export default function PdfAiImport({ context, onExtracted, disabled, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [instrucoes, setInstrucoes] = useState('')

  async function process(file: File) {
    setError(null)
    setLoading(true)
    try {
      const result = await extractPdfWithAI(file, context, instrucoes)
      onExtracted(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar PDF.')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) void process(file)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      {/* Campo de instruções */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Orientação para a IA <span className="text-slate-600">(opcional)</span>
        </label>
        <textarea
          value={instrucoes}
          onChange={(e) => setInstrucoes(e.target.value)}
          disabled={loading || disabled}
          rows={2}
          placeholder={placeholder ?? PLACEHOLDERS[context]}
          className="w-full rounded-md bg-slate-800/60 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        />
      </div>

      {/* Dropzone */}
      <div
        className={[
          'relative border-2 border-dashed rounded-xl p-6 text-center transition-colors',
          dragging ? 'border-amber-400 bg-amber-400/5' : 'border-slate-700 hover:border-slate-500',
          disabled || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer',
        ].join(' ')}
        onClick={() => !loading && !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <span className="inline-block w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Agente lendo o documento...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-sm font-medium text-slate-300">
              Arraste um PDF ou clique para selecionar
            </span>
            <span className="text-xs text-slate-500">PDF até 3 MB · A IA extrai os dados automaticamente</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
