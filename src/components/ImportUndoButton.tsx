import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import {
  getUltimoBatchUsuario,
  desfazerImportBatch,
  type ImportBatch,
  type ImportTipo,
} from '../lib/importBatches'
import Button from './ui/Button'

interface Props {
  condominio_id: string
  tipo: ImportTipo
  refreshKey?: number     // bump pra revalidar quando uma importacao terminar
  onUndone?: () => void
}

/**
 * Mostra "Última importação: N registros · 15min atrás" + botão pra desfazer.
 * Desfazer apaga somente registros INSERTed com import_batch_id == batch.id
 * (do usuário logado, na ultima importacao). Marca o batch como desfeito.
 */
export default function ImportUndoButton({ condominio_id, tipo, refreshKey, onUndone }: Props) {
  const { user } = useAuth()
  const [batch, setBatch] = useState<ImportBatch | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancel = false
    getUltimoBatchUsuario({ condominio_id, user_id: user.id, tipo })
      .then((b) => { if (!cancel) setBatch(b) })
      .catch(() => { /* noop */ })
    return () => { cancel = true }
  }, [condominio_id, user, tipo, refreshKey])

  if (!batch || batch.total_criados === 0) return null

  const idade = idadeRelativa(batch.created_at)

  async function desfazer() {
    if (!batch) return
    if (!window.confirm(
      `Desfazer a última importação?\n\n` +
      `Vai apagar ${batch.total_criados} registro${batch.total_criados !== 1 ? 's' : ''} criado${batch.total_criados !== 1 ? 's' : ''} ${idade}.\n` +
      `Esta ação é destrutiva — registros editados manualmente após a importação também são apagados.`,
    )) return
    setBusy(true)
    try {
      const n = await desfazerImportBatch(batch)
      alert(`${n} registro${n !== 1 ? 's apagados' : ' apagado'}.`)
      setBatch(null)
      onUndone?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao desfazer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
      <div className="text-amber-100">
        <strong>Última importação:</strong> {batch.total_criados} registro{batch.total_criados !== 1 ? 's' : ''} · {idade}
      </div>
      <Button size="sm" variant="danger" onClick={desfazer} disabled={busy}>
        {busy ? 'Desfazendo...' : '↶ Desfazer'}
      </Button>
    </div>
  )
}

function idadeRelativa(iso: string): string {
  const dt = new Date(iso).getTime()
  const diff = Date.now() - dt
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}
