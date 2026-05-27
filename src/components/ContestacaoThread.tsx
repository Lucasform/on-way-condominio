import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { listContestacoes, postContestacao } from '../lib/contestacoes'
import type { Contestacao } from '../types/contestacao'
import { useAuth } from './AuthProvider'
import Button from './ui/Button'
import { TextArea } from './ui/Input'

interface Props {
  multaId: string
  pessoaUserId: string | null  // user_id da pessoa vinculada à multa (se houver)
}

export default function ContestacaoThread({ multaId, pessoaUserId }: Props) {
  const { user, perfil } = useAuth()
  const [items, setItems] = useState<Contestacao[]>([])
  const [loading, setLoading] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await listContestacoes(multaId)
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multaId])

  // Realtime: atualiza quando alguém posta
  useEffect(() => {
    const channel = supabase
      .channel(`contestacoes:${multaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contestacoes', filter: `multa_id=eq.${multaId}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multaId])

  const isMorador = perfil?.role === 'morador'
  const isStaff = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)
  const podePostar = isMorador
    ? user?.id === pessoaUserId  // só o morador vinculado pode contestar
    : isStaff

  async function handlePost(e: FormEvent) {
    e.preventDefault()
    if (!user || !mensagem.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const autorTipo = isMorador ? 'morador' : 'staff'
      await postContestacao(multaId, user.id, autorTipo, mensagem)
      setMensagem('')
      // load() é disparado pelo realtime
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
      <div className="text-sm font-medium text-slate-200 mb-3">
        💬 Contestação / Diálogo
      </div>

      {loading ? (
        <div className="text-xs text-slate-500">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-slate-500 italic mb-3">
          Nenhuma mensagem ainda.{' '}
          {isMorador && podePostar
            ? 'Você pode contestar esta multa abaixo.'
            : 'O morador pode iniciar uma contestação aqui.'}
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {items.map((c) => (
            <div
              key={c.id}
              className={`flex ${c.autor_tipo === 'morador' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  c.autor_tipo === 'morador'
                    ? 'bg-slate-800 text-slate-100'
                    : 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-50'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                  {c.autor_tipo === 'morador' ? '👤 Morador' : '🏢 Administração'} ·{' '}
                  {new Date(c.created_at).toLocaleString('pt-BR')}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.mensagem}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {podePostar && (
        <form onSubmit={handlePost} className="space-y-2 border-t border-slate-800 pt-3">
          <TextArea
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder={
              isMorador
                ? 'Escreva sua contestação. A administração será notificada.'
                : 'Responda ao morador.'
            }
          />
          {error && (
            <div className="text-xs text-red-400">{error}</div>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={submitting || !mensagem.trim()}>
              {submitting ? 'Enviando...' : isMorador ? 'Contestar' : 'Responder'}
            </Button>
            {isMorador && (
              <span className="text-xs text-slate-500">
                Ao enviar, a multa passa a status "contestada".
              </span>
            )}
          </div>
        </form>
      )}

      {!podePostar && (
        <div className="text-xs text-slate-600 italic">
          {isMorador
            ? 'Apenas o morador vinculado a esta multa pode contestar.'
            : 'Apenas administração e morador participam desta thread.'}
        </div>
      )}
    </div>
  )
}
