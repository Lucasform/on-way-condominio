import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  condominio_id: string
  current: string | null
  onChange: (v: string | null) => void
}

/**
 * Área pro síndico/admin escrever instruções customizadas que a IA vai usar
 * sempre que analisar uma ocorrência desse condomínio. Vai pro system prompt
 * da Edge analyze-ocorrencia (cacheado pelo Claude).
 */
export default function AgenteTreinamento({ condominio_id, current, onChange }: Props) {
  const [valor, setValor] = useState(current ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setValor(current ?? '') }, [current])

  const sujo = (current ?? '') !== valor

  async function handleSalvar() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const novo = valor.trim() || null
      const { error: upErr } = await supabase
        .from('condominios')
        .update({ ai_instrucoes: novo })
        .eq('id', condominio_id)
      if (upErr) throw upErr
      onChange(novo)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <fieldset className="border border-slate-700 rounded-md p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold text-slate-200">
        🤖 Treinar o Agente IA
      </legend>
      <p className="text-xs text-slate-400 -mt-2">
        Escreva instruções, lembretes e regras que a IA deve seguir ao analisar ocorrências e gerar minutas neste condomínio. Vale tudo: tom de comunicação, particularidades do prédio, valores praticados, frases que sempre devem aparecer, casos a tratar com mais atenção.
      </p>

      <textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        rows={10}
        maxLength={3000}
        placeholder={EXEMPLO}
        className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 focus:border-brand-500 focus:outline-none text-sm text-slate-100 font-normal leading-relaxed"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-slate-500">
          {valor.length}/3000 caracteres · entra como contexto persistente no prompt da IA (cacheado, custo baixo)
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-400">✓ Salvo</span>
          )}
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving || !sujo}
            className="px-4 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar instruções'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </fieldset>
  )
}

const EXEMPLO = `Exemplos do que escrever aqui:

- Nosso condomínio é familiar e prefere tom respeitoso, sem ameaças.
- Multas de barulho no horário noturno (22h às 8h) são sempre R$ 300 na primeira ocorrência.
- Para infrações de uso da garagem, mencione sempre o Art. 12 da convenção.
- Antes de aplicar multa em moradores idosos, sugira advertência primeiro.
- Em casos de reincidência (terceira ocorrência), valor da multa dobra.
- Citar sempre que a contestação pode ser feita em até 30 dias no app OnWay.`
