import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { useToast } from './ui/Toast'

type Tipo = 'sugestao' | 'problema' | 'elogio' | 'outro'

const TIPOS: { value: Tipo; label: string; emoji: string }[] = [
  { value: 'sugestao', label: 'Sugestão', emoji: '💡' },
  { value: 'problema', label: 'Problema', emoji: '🐛' },
  { value: 'elogio', label: 'Elogio', emoji: '⭐' },
  { value: 'outro', label: 'Outro', emoji: '💬' },
]

export default function FeedbackWidget() {
  const { user, perfil } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('sugestao')
  const [mensagem, setMensagem] = useState('')
  const [saving, setSaving] = useState(false)

  async function enviar() {
    if (mensagem.trim().length < 3) {
      toast.error('Escreva um pouco mais', 'Conte o que você quer sugerir ou relatar.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('feedback').insert({
      condominio_id: perfil?.condominio_id ?? null,
      autor_id: user?.id ?? null,
      tipo,
      mensagem: mensagem.trim(),
    })
    setSaving(false)
    if (error) {
      toast.error('Não foi possível enviar', error.message)
      return
    }
    toast.success('Feedback enviado', 'Obrigado! A gente lê tudo.')
    setMensagem('')
    setTipo('sugestao')
    setOpen(false)
  }

  const tipoAtual = TIPOS.find((t) => t.value === tipo)!

  return (
    <>
      {/* Painel */}
      {open && (
        <div className="fixed right-4 bottom-20 md:bottom-4 z-50 w-80 md:w-96 rounded-2xl shadow-2xl shadow-black/50 border border-slate-700 bg-slate-900 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
            <span className="text-lg leading-none shrink-0">💬</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-100">Enviar feedback</div>
              <div className="text-[10px] text-slate-500">Sugestões, problemas ou elogios</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 transition"
              title="Fechar"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Corpo */}
          <div className="p-4 space-y-4">
            {/* Seletor de tipo em pills */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition border',
                      tipo === t.value
                        ? 'bg-brand-600/30 border-brand-500/60 text-brand-300'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600',
                    ].join(' ')}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mensagem */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Mensagem</p>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                placeholder={`Conte o que você quer ${tipoAtual.label.toLowerCase()}...`}
                maxLength={4000}
                className="w-full rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 placeholder-slate-600 text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-4 py-3 flex justify-end gap-2 bg-slate-900/60">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={saving || mensagem.trim().length < 3}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition disabled:opacity-40"
            >
              {saving ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Enviar feedback"
        title="Enviar feedback"
        style={{ display: open ? 'none' : undefined }}
        className="fixed right-4 bottom-20 md:bottom-4 z-40 h-12 w-12 rounded-full bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white shadow-lg shadow-black/30 flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <ChatIcon />
      </button>
    </>
  )
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
