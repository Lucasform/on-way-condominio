import { useEffect, useMemo, useState } from 'react'
import { listTemplates, type MensagemTemplate, type TemplateTipo } from '../lib/templates'

interface Props {
  condominio_id: string
  tipo: TemplateTipo
  onSelect: (t: MensagemTemplate) => void
  label?: string
}

export default function TemplatePicker({ condominio_id, tipo, onSelect, label = '📋 Templates' }: Props) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<MensagemTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listTemplates({ condominio_id, tipo, apenas_ativos: true })
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [open, condominio_id, tipo])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) =>
      t.titulo.toLowerCase().includes(q) || t.corpo.toLowerCase().includes(q),
    )
  }, [templates, busca])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-8 sm:pt-16 px-3 sm:px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-[90vw] sm:w-full max-w-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
              <div className="text-sm font-semibold text-slate-100 flex-1">
                Escolher template ({tipo === 'chat' ? 'chat' : tipo === 'whatsapp' ? 'WhatsApp' : 'e-mail'})
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 border-b border-slate-800">
              <input
                type="text"
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título ou conteúdo..."
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-brand-700 focus:outline-none"
              />
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-sm text-slate-500">Carregando...</div>
              ) : filtrados.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  {templates.length === 0
                    ? 'Nenhum template cadastrado. Peça à administração pra criar em Templates.'
                    : 'Nenhum resultado.'}
                </div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {filtrados.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => { onSelect(t); setOpen(false) }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800 transition"
                      >
                        <div className="text-sm font-medium text-slate-100">{t.titulo}</div>
                        {tipo === 'email' && t.assunto && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            Assunto: {t.assunto}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-slate-400 whitespace-pre-wrap line-clamp-3">
                          {t.corpo}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
