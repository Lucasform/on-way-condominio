import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { useToast } from './ui/Toast'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { Field, TextArea, Select } from './ui/Input'

type Tipo = 'sugestao' | 'problema' | 'elogio' | 'outro'

const TIPOS: { value: Tipo; label: string }[] = [
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'problema', label: 'Problema' },
  { value: 'elogio', label: 'Elogio' },
  { value: 'outro', label: 'Outro' },
]

/**
 * Loop de feedback do usuário: botão flutuante + modal que grava na tabela
 * `feedback` (migration 0103). Disponível em todo o app autenticado via AppShell.
 */
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
        title="Enviar feedback"
        className="fixed right-4 bottom-20 md:bottom-4 z-40 h-12 w-12 rounded-full bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white shadow-lg shadow-black/30 flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enviar feedback"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={enviar} disabled={saving}>{saving ? 'Enviando...' : 'Enviar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Mensagem">
            <TextArea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={5}
              placeholder="Conte o que você quer sugerir, relatar ou elogiar."
              maxLength={4000}
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
