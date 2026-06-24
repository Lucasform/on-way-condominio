import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { extractPdfWithAI, type PdfAiContext, type PdfExtractResult } from '../lib/pdfAi'

interface Props {
  context: PdfAiContext
  onExtracted: (result: PdfExtractResult) => void
  disabled?: boolean
  label?: string
}

export default function PdfAiImport({ context, onExtracted, disabled, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function process(file: File) {
    setError(null)
    setLoading(true)
    try {
      const result = await extractPdfWithAI(file, context)
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
    <div className="space-y-2">
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
              {label ?? 'Arraste um PDF ou clique para selecionar'}
            </span>
            <span className="text-xs text-slate-500">PDF até 5 MB · A IA extrai os dados automaticamente</span>
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
