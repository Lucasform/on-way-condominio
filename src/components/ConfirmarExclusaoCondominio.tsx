import { useEffect, useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Pill from './ui/Pill'
import { TextInput } from './ui/Input'
import { previewExclusaoCondominio } from '../lib/condominios'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  condominioId: string
  condominioNome: string
  loading?: boolean
}

interface Counts {
  unidades: number
  pessoas: number
  usuarios: number
  ocorrencias: number
  multas: number
  chamados: number
  comunicados: number
  publicacoes: number
}

const CONFIRM_WORD = 'EXCLUIR'

export default function ConfirmarExclusaoCondominio({
  open, onClose, onConfirm, condominioId, condominioNome, loading,
}: Props) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (!open) {
      setConfirmText('')
      setCounts(null)
      return
    }
    setCarregando(true)
    previewExclusaoCondominio(condominioId)
      .then(setCounts)
      .catch(() => setCounts(null))
      .finally(() => setCarregando(false))
  }, [open, condominioId])

  const podeConfirmar = confirmText.trim().toUpperCase() === CONFIRM_WORD && !loading

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2 text-red-300">
          <span>⚠</span>
          <span>Excluir condomínio definitivamente</span>
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!podeConfirmar}
            loading={loading}
          >
            Excluir tudo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-slate-200">
          Você está prestes a apagar <strong className="text-red-300">{condominioNome}</strong>{' '}
          e <strong>todos os dados</strong> ligados a ele. <strong>Esta ação é irreversível.</strong>
        </p>

        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4">
          <div className="text-xs font-medium text-red-200 uppercase tracking-wide mb-2">
            O que será apagado
          </div>
          {carregando && (
            <div className="text-xs text-slate-400 italic">Calculando...</div>
          )}
          {counts && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Usuários" value={counts.usuarios} highlight />
              <Stat label="Unidades" value={counts.unidades} />
              <Stat label="Pessoas" value={counts.pessoas} />
              <Stat label="Publicações" value={counts.publicacoes} />
              <Stat label="Ocorrências" value={counts.ocorrencias} />
              <Stat label="Multas" value={counts.multas} />
              <Stat label="Chamados" value={counts.chamados} />
              <Stat label="Comunicados" value={counts.comunicados} />
            </div>
          )}
          <div className="mt-3 text-xs text-slate-400 leading-relaxed">
            Além disso: mural, calendário, assembleias, votações, chat, encomendas, regimento,
            anexos, classificados, acessos autorizados, convites e logs de auditoria deste condomínio.
          </div>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200 flex items-start gap-2">
          <span className="text-base leading-none">🚨</span>
          <div>
            <div className="font-medium mb-0.5">Contas de e-mail também são removidas.</div>
            Os {counts?.usuarios ?? '...'} usuários perdem acesso a TODA a plataforma OnWay,
            não só a este condomínio. Não dá pra desfazer.
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">
            Pra confirmar, digite <Pill tone="danger" className="!font-mono">{CONFIRM_WORD}</Pill> abaixo:
          </label>
          <TextInput
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
          />
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${highlight ? 'text-red-300' : 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  )
}
