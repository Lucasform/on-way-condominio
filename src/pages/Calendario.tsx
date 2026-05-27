import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listEventos } from '../lib/eventos'
import { listMultas } from '../lib/multas'
import { listCondominios } from '../lib/condominios'
import type { Evento, TipoEvento } from '../types/evento'
import type { Multa } from '../types/multa'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'

// ----------------------------------------------------------------
// Tipos do calendário (eventos reais + eventos derivados de multas)
// ----------------------------------------------------------------

interface CalItem {
  date: string  // YYYY-MM-DD
  kind: 'evento' | 'prazo_multa'
  id: string    // id do evento ou da multa
  titulo: string
  tipo?: TipoEvento
  color: string
  link: string
}

const TIPO_COLOR: Record<TipoEvento, string> = {
  assembleia: 'bg-purple-500/15 text-purple-200 border-purple-500/40',
  manutencao: 'bg-orange-500/15 text-orange-200 border-orange-500/40',
  evento: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  reuniao: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  outro: 'bg-slate-600/20 text-slate-200 border-slate-500/40',
}

const PRAZO_MULTA_COLOR = 'bg-red-500/15 text-red-200 border-red-500/40'

const PRAZO_CONTESTACAO_DIAS = 10  // padrão do regimento exemplo

// ----------------------------------------------------------------

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return ymd(d)
}

function monthGrid(year: number, monthIdx0: number): Date[] {
  // Retorna 42 dias começando do domingo da semana do dia 1.
  const first = new Date(year, monthIdx0, 1)
  const dow = first.getDay() // 0=dom
  const start = new Date(year, monthIdx0, 1 - dow)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// ----------------------------------------------------------------

export default function Calendario() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id
  const canCreate = perfil && ['admin_onway', 'administradora', 'sindico', 'subsindico'].includes(perfil.role)

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [multas, setMultas] = useState<Multa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() } // month 0-11
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(ymd(new Date()))

  useEffect(() => {
    if (isAdmin) {
      listCondominios()
        .then((cs) => {
          setCondos(cs)
          if (cs.length && !scopeId) setScopeId(cs[0].id)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const cid = isAdmin && scopeId ? scopeId : undefined
      // Janela: 3 meses anteriores + 6 meses à frente (suficiente pra navegação)
      const desde = new Date(cursor.year, cursor.month - 3, 1).toISOString()
      const ate = new Date(cursor.year, cursor.month + 6, 0).toISOString()
      const [evs, mts] = await Promise.all([
        listEventos({ condominio_id: cid, desde, ate }),
        listMultas({ condominio_id: cid }),
      ])
      setEventos(evs)
      setMultas(mts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !scopeId) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, cursor.year, cursor.month])

  // Constrói itens do calendário (eventos + prazos derivados de multas)
  const itemsByDate = useMemo<Map<string, CalItem[]>>(() => {
    const map = new Map<string, CalItem[]>()
    const push = (item: CalItem) => {
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }

    for (const e of eventos) {
      push({
        date: ymd(new Date(e.data_inicio)),
        kind: 'evento',
        id: e.id,
        titulo: e.titulo,
        tipo: e.tipo,
        color: TIPO_COLOR[e.tipo],
        link: `/calendario/${e.id}`,
      })
    }

    // Derivar prazos de contestação das multas aplicadas/contestadas
    for (const m of multas) {
      if (!m.data_aplicacao) continue
      if (m.status !== 'aplicada' && m.status !== 'contestada') continue
      const prazo = addDays(m.data_aplicacao, PRAZO_CONTESTACAO_DIAS)
      push({
        date: prazo,
        kind: 'prazo_multa',
        id: m.id,
        titulo: `Prazo contestação · R$ ${Number(m.valor).toFixed(2).replace('.', ',')}`,
        color: PRAZO_MULTA_COLOR,
        link: `/multas/${m.id}`,
      })
    }

    return map
  }, [eventos, multas])

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  function changeMonth(delta: number) {
    setCursor((c) => {
      const total = c.month + delta
      const year = c.year + Math.floor(total / 12)
      const month = ((total % 12) + 12) % 12
      return { year, month }
    })
  }

  const selectedItems = selectedDay ? itemsByDate.get(selectedDay) ?? [] : []

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-6xl">
      <PageHeader
        title="Calendário"
        subtitle="Eventos do condomínio e prazos importantes."
        actions={
          canCreate && (
            <Link to="/calendario/novo">
              <Button>+ Novo evento</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-4 items-end">
        {isAdmin && condos.length > 0 && (
          <div className="min-w-[220px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Condomínio</label>
            <Select value={scopeId ?? ''} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="secondary" onClick={() => changeMonth(-1)}>← Mês anterior</Button>
          <div className="px-4 text-base font-medium text-slate-100 capitalize w-44 text-center">
            {monthName}
          </div>
          <Button variant="secondary" onClick={() => changeMonth(+1)}>Próximo mês →</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Grid mensal */}
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <div className="grid grid-cols-7 text-xs font-medium text-slate-500 uppercase bg-slate-900/60 border-b border-slate-800">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="px-2 py-2 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-6">
            {grid.map((d) => {
              const date = ymd(d)
              const inMonth = d.getMonth() === cursor.month
              const items = itemsByDate.get(date) ?? []
              const isToday = date === ymd(new Date())
              const isSelected = date === selectedDay
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDay(date)}
                  className={`min-h-[88px] text-left p-1.5 border-r border-b border-slate-800/60 transition flex flex-col gap-1 ${
                    inMonth ? 'bg-slate-900/30' : 'bg-slate-950/40 opacity-50'
                  } ${isSelected ? 'ring-2 ring-emerald-500/60 z-10' : ''} hover:bg-slate-800/40`}
                >
                  <div className={`text-xs font-mono ${isToday ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map((it) => (
                      <div
                        key={`${it.kind}-${it.id}`}
                        className={`px-1.5 py-0.5 rounded text-[10px] border truncate ${it.color}`}
                        title={it.titulo}
                      >
                        {it.kind === 'prazo_multa' ? '⏰ ' : ''}{it.titulo}
                      </div>
                    ))}
                    {items.length > 3 && (
                      <div className="text-[10px] text-slate-500 pl-1">+{items.length - 3}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Painel lateral: detalhe do dia selecionado */}
        <aside className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 self-start max-h-[600px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-100 mb-1">
            {selectedDay
              ? new Date(selectedDay).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : 'Selecione um dia'}
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            {selectedItems.length === 0 ? 'Nada agendado' : `${selectedItems.length} item(s)`}
          </p>

          {loading ? (
            <div className="text-xs text-slate-500">Carregando...</div>
          ) : (
            <div className="space-y-2">
              {selectedItems.length === 0 ? (
                <div className="text-xs text-slate-600">—</div>
              ) : (
                selectedItems.map((it) => (
                  <button
                    key={`${it.kind}-${it.id}`}
                    onClick={() => navigate(it.link)}
                    className={`block w-full text-left px-3 py-2 rounded border text-sm ${it.color} hover:opacity-90 transition`}
                  >
                    <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
                      {it.kind === 'prazo_multa' ? '⏰ Prazo de multa' : it.tipo ?? 'Evento'}
                    </div>
                    <div className="font-medium leading-tight">{it.titulo}</div>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-1">
            <div>Legenda:</div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {(Object.entries(TIPO_COLOR) as [TipoEvento, string][]).map(([t, c]) => (
                <span key={t} className={`px-1.5 py-0.5 rounded border ${c}`}>{t}</span>
              ))}
              <span className={`px-1.5 py-0.5 rounded border ${PRAZO_MULTA_COLOR}`}>prazo multa</span>
            </div>
          </div>
        </aside>
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Prazos de multa são derivados automaticamente: {PRAZO_CONTESTACAO_DIAS} dias após a aplicação.
      </p>
    </div>
  )
}
