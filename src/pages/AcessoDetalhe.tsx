import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import {
  deleteAcesso,
  getAcesso,
  listEventos,
  registrarEvento,
} from '../lib/acessos'
import { getUnidade } from '../lib/unidades'
import { isGestor, isStaff } from '../lib/permissions'
import type { AcessoAutorizado, AcessoEvento, StatusAcesso, TipoEventoAcesso } from '../types/acesso'
import type { Unidade } from '../types/unidade'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import DeleteButton from '../components/ui/DeleteButton'
import { DetailSkeleton } from '../components/ui/Skeleton'
import { sendWhatsApp } from '../lib/whatsapp'
import { sendEmail } from '../lib/email'
import { supabase } from '../lib/supabase'

const STATUS_LABEL: Record<StatusAcesso, string> = {
  ativo: 'Ativo',
  usado: 'Entrou',
  expirado: 'Expirado',
  revogado: 'Revogado',
  negado: 'Negado',
}

const STATUS_CLASS: Record<StatusAcesso, string> = {
  ativo: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  usado: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  expirado: 'bg-slate-700/40 text-slate-400 border-slate-700',
  revogado: 'bg-red-500/10 text-red-300 border-red-500/30',
  negado: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
}

function vigenciaExpirou(r: { status: StatusAcesso; vigencia_fim: string | null }): boolean {
  if (r.status !== 'ativo') return false
  if (!r.vigencia_fim) return false
  return new Date(r.vigencia_fim).getTime() < Date.now()
}

function statusEfetivo(r: { status: StatusAcesso; vigencia_fim: string | null }): StatusAcesso {
  return vigenciaExpirou(r) ? 'expirado' : r.status
}

const EVENTO_LABEL: Record<TipoEventoAcesso, string> = {
  entrada: '✓ Entrada registrada',
  saida: '↩ Saída registrada',
  negada: '✗ Acesso negado',
  revogada: '⛔ Autorização revogada',
}

export default function AcessoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, perfil } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const staff = isStaff(perfil?.role)
  const podeApagar = isGestor(perfil?.role)

  const [acesso, setAcesso] = useState<AcessoAutorizado | null>(null)
  const [unidade, setUnidade] = useState<Unidade | null>(null)
  const [eventos, setEventos] = useState<AcessoEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [liberarModal, setLiberarModal] = useState(false)
  const [notifWa, setNotifWa] = useState(true)
  const [notifEmail, setNotifEmail] = useState(true)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const a = await getAcesso(id)
      if (!a) {
        setError('Acesso não encontrado.')
        setLoading(false)
        return
      }
      setAcesso(a)
      const [un, evs] = await Promise.all([
        a.unidade_id ? getUnidade(a.unidade_id) : Promise.resolve(null),
        listEventos(a.id),
      ])
      setUnidade(un)
      setEventos(evs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function confirmarEntrada() {
    if (!acesso || !user) return
    setLiberarModal(false)
    setWorking(true)
    try {
      await registrarEvento({
        acesso_id: acesso.id,
        condominio_id: acesso.condominio_id,
        tipo: 'entrada',
        registrado_por: user.id,
        motivo: null,
      })

      // Busca moradores da unidade para notificar
      if (notifWa || notifEmail) {
        const { data: pessoas } = await supabase
          .from('pessoas')
          .select('telefone, email, nome')
          .eq('unidade_id', acesso.unidade_id)
          .eq('ativo', true)

        const texto = `✅ *${acesso.nome}* acaba de entrar no condomínio.\nAutorizado pela portaria.`

        for (const p of (pessoas ?? []) as Array<{ telefone: string | null; email: string | null; nome: string }>) {
          if (notifWa && p.telefone) {
            sendWhatsApp({ condominio_id: acesso.condominio_id, telefone: p.telefone, texto })
              .catch((e) => console.warn('[acesso] whatsapp falhou:', e?.message))
          }
          if (notifEmail && p.email) {
            sendEmail({
              to: p.email,
              template: 'custom',
              condominio_id: acesso.condominio_id,
              custom: {
                subject: `${acesso.nome} entrou no condomínio`,
                html: `<p>Olá${p.nome ? `, ${p.nome}` : ''}.</p><p><strong>${acesso.nome}</strong> acaba de ser liberado(a) pela portaria e entrou no condomínio.</p>`,
              },
            }).catch((e) => console.warn('[acesso] email falhou:', e?.message))
          }
        }
      }

      toast.success('✓ Entrada registrada')
      await load()
    } catch (e) {
      toast.error('Erro ao registrar', e instanceof Error ? e.message : '')
    } finally {
      setWorking(false)
    }
  }

  async function handleEvento(tipo: TipoEventoAcesso, askMotivo = false) {
    if (!acesso || !user) return
    let motivo: string | null = null
    if (askMotivo) {
      const m = window.prompt(tipo === 'negada' ? 'Motivo da negativa:' : 'Motivo (opcional):')
      if (m === null) return
      motivo = m || null
    }
    const ok = await confirm({
      message: `Confirmar: ${EVENTO_LABEL[tipo]}?`,
      tone: tipo === 'negada' || tipo === 'revogada' ? 'danger' : 'primary',
    })
    if (!ok) return
    setWorking(true)
    try {
      await registrarEvento({
        acesso_id: acesso.id,
        condominio_id: acesso.condominio_id,
        tipo,
        registrado_por: user.id,
        motivo,
      })
      toast.success(EVENTO_LABEL[tipo])
      await load()
    } catch (e) {
      toast.error('Erro ao registrar', e instanceof Error ? e.message : '')
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete() {
    if (!acesso) return
    const ok = await confirm({
      title: 'Excluir registro',
      message: 'Apagar esse registro DEFINITIVAMENTE?',
      tone: 'danger',
      confirmText: 'Excluir',
    })
    if (!ok) return
    setWorking(true)
    try {
      await deleteAcesso(acesso.id)
      toast.success('Acesso excluído.')
      navigate('/acessos')
    } catch (e) {
      toast.error('Erro ao excluir', e instanceof Error ? e.message : '')
      setWorking(false)
    }
  }

  if (loading) {
    return <DetailSkeleton />
  }

  if (error || !acesso) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
        <PageHeader
          title="Acesso"
          actions={
            <Link to="/acessos">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          }
        />
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error ?? 'Não encontrado.'}
        </div>
      </div>
    )
  }

  const efetivo = statusEfetivo(acesso)
  const podeRegistrarEvento = staff && efetivo === 'ativo'
  const podeRevogar = efetivo === 'ativo' && (staff || acesso.criado_por === user?.id)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Acesso autorizado"
        actions={
          <div className="flex items-center gap-2">
            {podeApagar && <DeleteButton onClick={handleDelete} disabled={working} />}
            <Link to="/acessos">
              <Button variant="ghost">← Voltar</Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-medium text-slate-100">{acesso.nome}</div>
            <div className="text-xs text-slate-400 mt-1 capitalize">{acesso.tipo}</div>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded text-xs border ${STATUS_CLASS[efetivo]}`}>
            {STATUS_LABEL[efetivo]}
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
          <dt className="text-slate-500">Unidade</dt>
          <dd className="text-slate-200">
            {unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'}
          </dd>

          {acesso.documento_numero && (
            <>
              <dt className="text-slate-500">Documento</dt>
              <dd className="text-slate-200">
                {acesso.documento_tipo?.toUpperCase() ?? 'DOC'} {acesso.documento_numero}
              </dd>
            </>
          )}

          {acesso.telefone && (
            <>
              <dt className="text-slate-500">Telefone</dt>
              <dd className="text-slate-200">{acesso.telefone}</dd>
            </>
          )}

          <dt className="text-slate-500">Início</dt>
          <dd className="text-slate-200">
            {new Date(acesso.vigencia_inicio).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
          </dd>

          <dt className="text-slate-500">Fim</dt>
          <dd className="text-slate-200">
            {acesso.vigencia_fim
              ? new Date(acesso.vigencia_fim).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
              : <span className="text-slate-500 italic">Sem prazo</span>}
          </dd>
        </dl>

        {acesso.observacao && (
          <div className="border-t border-slate-800 pt-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Observação</div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{acesso.observacao}</p>
          </div>
        )}
      </div>

      {(podeRegistrarEvento || podeRevogar) && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/40 p-5">
          <div className="text-sm font-medium text-slate-200 mb-3">Ações</div>
          {podeRegistrarEvento && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => setLiberarModal(true)}
                disabled={working}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold py-5 text-base transition disabled:opacity-50"
              >
                ✓ Liberar entrada
              </button>
              <button
                onClick={() => handleEvento('negada', true)}
                disabled={working}
                className="rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold py-5 text-base transition disabled:opacity-50"
              >
                ✗ Negar
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {podeRegistrarEvento && (
              <Button variant="ghost" onClick={() => handleEvento('saida')} disabled={working}>
                ↩ Registrar saída
              </Button>
            )}
            {podeRevogar && (
              <Button variant="ghost" onClick={() => handleEvento('revogada', true)} disabled={working}>
                ⛔ Revogar
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
        <div className="text-sm font-medium text-slate-200 mb-3">Linha do tempo</div>
        {eventos.length === 0 ? (
          <div className="text-sm text-slate-500 italic">Nenhum evento ainda.</div>
        ) : (
          <ul className="space-y-3">
            {eventos.map((ev) => (
              <li key={ev.id} className="text-sm border-l-2 border-slate-700 pl-3">
                <div className="text-slate-200">{EVENTO_LABEL[ev.tipo]}</div>
                <div className="text-xs text-slate-500">
                  {new Date(ev.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                {ev.motivo && (
                  <div className="text-xs text-slate-400 mt-1 italic">{ev.motivo}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Modal de liberação com opções de notificação */}
      {liberarModal && acesso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-base font-semibold text-slate-100 mb-1">Liberar entrada</h4>
            <p className="text-sm text-slate-400 mb-5">
              <span className="font-medium text-slate-200">{acesso.nome}</span> · notificar a unidade?
            </p>

            <div className="space-y-2 mb-6">
              {[
                { key: 'wa', label: 'WhatsApp', icon: '💬', val: notifWa, set: setNotifWa },
                { key: 'email', label: 'E-mail', icon: '✉️', val: notifEmail, set: setNotifEmail },
              ].map(({ key, label, icon, val, set }) => (
                <button
                  key={key}
                  onClick={() => set(!val)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                    val
                      ? 'border-brand-500 bg-brand-500/10 text-slate-100'
                      : 'border-slate-700 bg-slate-800/40 text-slate-400'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${val ? 'border-brand-400 bg-brand-400' : 'border-slate-600'}`}>
                    {val && <span className="w-2 h-2 rounded-full bg-white block" />}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setLiberarModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEntrada}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                {notifWa || notifEmail ? 'Liberar e notificar' : 'Liberar sem notificar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

