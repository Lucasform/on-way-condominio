import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  applyHeaderMap,
  gerarXlsxModelo,
  numberOrNull,
  parseTabularFile,
} from '../lib/importHelpers'

interface Props {
  condominio_id: string
  onDone?: () => void
}

interface Row {
  bloco: string | null
  numero: string
  tipo: string
  area_m2: number | null
}

interface RowResult {
  row: Row
  status: 'ok' | 'dup' | 'erro' | 'pendente'
  msg?: string
}

const TIPOS_VALIDOS = ['apartamento', 'casa', 'sala', 'loja', 'kitnet', 'cobertura', 'outro']

const HEADER_MAP: Record<string, keyof Row> = {
  bloco: 'bloco', torre: 'bloco', predio: 'bloco', edificio: 'bloco',
  numero: 'numero', número: 'numero', n: 'numero',
  apto: 'numero', apartamento: 'numero', unidade: 'numero',
  tipo: 'tipo', categoria: 'tipo',
  area: 'area_m2', area_m2: 'area_m2', m2: 'area_m2', metragem: 'area_m2',
}

export default function UnidadesImport({ condominio_id, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [results, setResults] = useState<RowResult[] | null>(null)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function parseArquivo(file: File) {
    setError(null); setParsing(true); setResults(null)
    try {
      const dados = await parseTabularFile(file)
      const parsed = dados
        .map((raw) => {
          const r = applyHeaderMap<Row>(raw, HEADER_MAP)
          if (!r.numero) return null
          const tipoRaw = (r.tipo ?? 'apartamento').toString().toLowerCase()
          return {
            bloco: r.bloco?.toString().trim() || null,
            numero: r.numero.toString().trim(),
            tipo: TIPOS_VALIDOS.includes(tipoRaw) ? tipoRaw : 'apartamento',
            area_m2: numberOrNull(r.area_m2 as string | null | undefined),
          } as Row
        })
        .filter((r): r is Row => r !== null)
      setRows(parsed)
      if (!parsed.length) setError('Nenhuma linha válida. Confira se a coluna "numero" existe.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ler arquivo.')
    } finally {
      setParsing(false)
    }
  }

  async function importar() {
    setImportando(true)
    const res: RowResult[] = rows.map((r) => ({ row: r, status: 'pendente' }))
    try {
      // Mapa de unidades existentes pra detectar duplicatas
      const { data: existentes } = await supabase
        .from('unidades')
        .select('id, bloco, numero')
        .eq('condominio_id', condominio_id)
      const idx = new Set<string>()
      for (const u of existentes ?? []) idx.add(chave(u.bloco, u.numero))

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
          const ch = chave(r.bloco, r.numero)
          if (idx.has(ch)) {
            res[i] = { row: r, status: 'dup', msg: 'unidade já existe' }
            setResults([...res])
            continue
          }
          const { error: uErr } = await supabase.from('unidades').insert({
            condominio_id,
            bloco: r.bloco,
            numero: r.numero,
            tipo: r.tipo,
            area_m2: r.area_m2,
            ativo: true,
          })
          if (uErr) throw uErr
          idx.add(ch)
          res[i] = { row: r, status: 'ok' }
        } catch (e) {
          res[i] = { row: r, status: 'erro', msg: e instanceof Error ? e.message : String(e) }
        }
        setResults([...res])
      }
    } finally {
      setImportando(false)
      onDone?.()
    }
  }

  async function baixarTemplate() {
    await gerarXlsxModelo(
      'modelo-import-unidades.xlsx',
      'Unidades',
      ['bloco', 'numero', 'tipo', 'area_m2'],
      [
        ['A', '101', 'apartamento', 65],
        ['A', '102', 'apartamento', 72],
        ['B', '201', 'apartamento', 80],
        ['', '01',  'casa',        180],
      ],
      [10, 12, 16, 12],
    )
  }

  const totais = results
    ? {
        ok: results.filter((r) => r.status === 'ok').length,
        dup: results.filter((r) => r.status === 'dup').length,
        erro: results.filter((r) => r.status === 'erro').length,
      }
    : null

  return (
    <fieldset className="border border-slate-700 rounded-md p-4 space-y-4">
      <legend className="px-2 text-sm font-semibold text-slate-200">
        🏠 Importar unidades em massa
      </legend>
      <p className="text-xs text-slate-400 -mt-2">
        Aceita CSV ou XLSX. Pula duplicadas (mesmo bloco+número). Tipos válidos:
        apartamento, casa, sala, loja, kitnet, cobertura, outro.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={parsing || importando}
          className="px-4 py-2 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium disabled:opacity-50"
        >
          {parsing ? 'Lendo...' : '📂 Escolher arquivo'}
        </button>
        <button
          type="button"
          onClick={baixarTemplate}
          className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-700"
        >
          ⬇ Baixar modelo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && parseArquivo(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {rows.length > 0 && !results && (
        <div>
          <div className="text-sm text-slate-300 mb-2 flex items-baseline justify-between">
            <span><strong>{rows.length}</strong> unidades prontas pra importar.</span>
            <button
              type="button"
              onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = '' }}
              className="text-xs text-slate-500 hover:underline"
            >
              Limpar
            </button>
          </div>
          <Preview rows={rows} max={6} />
          <button
            type="button"
            onClick={importar}
            disabled={importando}
            className="mt-3 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {importando ? 'Importando...' : `✓ Importar ${rows.length} unidades`}
          </button>
        </div>
      )}

      {results && totais && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              ✓ Criadas: <strong>{totais.ok}</strong>
            </span>
            <span className="px-3 py-1.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              ⊘ Duplicadas: <strong>{totais.dup}</strong>
            </span>
            <span className="px-3 py-1.5 rounded bg-red-500/10 text-red-300 border border-red-500/30">
              ✗ Erros: <strong>{totais.erro}</strong>
            </span>
          </div>
          {totais.erro > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-400">Ver erros</summary>
              <ul className="mt-2 space-y-1">
                {results.filter((r) => r.status === 'erro').map((r, i) => (
                  <li key={i} className="text-red-400">
                    <strong>{r.row.bloco ? `${r.row.bloco}-` : ''}{r.row.numero}</strong>: {r.msg}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={() => { setRows([]); setResults(null); if (inputRef.current) inputRef.current.value = '' }}
            className="text-sm text-brand-400 hover:underline"
          >
            Importar outro arquivo
          </button>
        </div>
      )}
    </fieldset>
  )
}

function Preview({ rows, max }: { rows: Row[]; max: number }) {
  return (
    <div className="overflow-x-auto border border-slate-700 rounded">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/60 text-slate-500 uppercase">
          <tr>
            <th className="text-left px-2 py-1.5">Bloco</th>
            <th className="text-left px-2 py-1.5">Número</th>
            <th className="text-left px-2 py-1.5">Tipo</th>
            <th className="text-left px-2 py-1.5">Área (m²)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5">{r.bloco ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono">{r.numero}</td>
              <td className="px-2 py-1.5 capitalize">{r.tipo}</td>
              <td className="px-2 py-1.5 text-slate-400">{r.area_m2 ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > max && (
        <div className="px-2 py-1.5 text-xs text-slate-500 bg-slate-900/30">
          ...e mais {rows.length - max} linhas.
        </div>
      )}
    </div>
  )
}

function chave(bloco: string | null, numero: string): string {
  return `${(bloco ?? '').trim().toUpperCase()}|${numero.trim()}`
}
