import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  applyHeaderMap,
  digitsOrNull,
  gerarXlsxModelo,
  numberOrNull,
  parseTabularFile,
} from '../lib/importHelpers'

interface Props {
  condominio_id: string
  onDone?: () => void
}

interface Row {
  nome: string
  categoria: string
  telefone: string | null
  email: string | null
  documento: string | null
  valor_referencia: number | null
  observacoes: string | null
}

interface RowResult {
  row: Row
  status: 'ok' | 'dup' | 'erro' | 'pendente'
  msg?: string
}

const CATEGORIAS = ['eletrica', 'hidraulica', 'jardim', 'limpeza', 'seguranca', 'elevador', 'estrutural', 'outro']

const HEADER_MAP: Record<string, keyof Row> = {
  nome: 'nome', name: 'nome', razao_social: 'nome', empresa: 'nome',
  categoria: 'categoria', tipo: 'categoria', servico: 'categoria',
  telefone: 'telefone', celular: 'telefone', phone: 'telefone', contato: 'telefone',
  email: 'email', 'e-mail': 'email',
  documento: 'documento', cpf: 'documento', cnpj: 'documento', doc: 'documento',
  valor: 'valor_referencia', valor_referencia: 'valor_referencia', preco: 'valor_referencia',
  observacoes: 'observacoes', obs: 'observacoes', nota: 'observacoes',
}

export default function FornecedoresImport({ condominio_id, onDone }: Props) {
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
          if (!r.nome) return null
          const catRaw = (r.categoria ?? 'outro').toString().toLowerCase()
          return {
            nome: r.nome.toString().trim(),
            categoria: CATEGORIAS.includes(catRaw) ? catRaw : 'outro',
            telefone: digitsOrNull(r.telefone as string | null | undefined),
            email: (r.email as string | undefined)?.toString().trim() || null,
            documento: digitsOrNull(r.documento as string | null | undefined),
            valor_referencia: numberOrNull(r.valor_referencia as string | null | undefined),
            observacoes: (r.observacoes as string | undefined)?.toString().trim() || null,
          } as Row
        })
        .filter((r): r is Row => r !== null)
      setRows(parsed)
      if (!parsed.length) setError('Nenhuma linha válida. Confira se a coluna "nome" existe.')
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
      // Mapa de prestadores existentes (por nome) pra evitar duplicar
      const { data: existentes } = await supabase
        .from('prestadores')
        .select('id, nome')
        .eq('condominio_id', condominio_id)
      const idx = new Set<string>()
      for (const p of existentes ?? []) idx.add(p.nome.trim().toLowerCase())

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
          if (idx.has(r.nome.toLowerCase())) {
            res[i] = { row: r, status: 'dup', msg: 'prestador com esse nome já existe' }
            setResults([...res])
            continue
          }
          const { error: pErr } = await supabase.from('prestadores').insert({
            condominio_id,
            nome: r.nome,
            categoria: r.categoria,
            telefone: r.telefone,
            email: r.email,
            documento: r.documento,
            valor_referencia: r.valor_referencia,
            observacoes: r.observacoes,
            ativo: true,
          })
          if (pErr) throw pErr
          idx.add(r.nome.toLowerCase())
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
      'modelo-import-fornecedores.xlsx',
      'Fornecedores',
      ['nome', 'categoria', 'telefone', 'email', 'documento', 'valor_referencia', 'observacoes'],
      [
        ['Elétrica Silva',         'eletrica',   '11999990001', 'contato@silva.com', '12345678000190', 120, 'Atende 24h'],
        ['Hidro Express',          'hidraulica', '11999990002', '',                  '',               150, ''],
        ['Limpeza Total Serviços', 'limpeza',    '11999990003', 'limp@total.com',    '',               90,  'Quinzenal'],
      ],
      [24, 14, 14, 22, 18, 16, 26],
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
        🔧 Importar fornecedores em massa
      </legend>
      <p className="text-xs text-slate-400 -mt-2">
        Aceita CSV ou XLSX. Pula prestadores com nome já cadastrado. Telefone e
        CPF/CNPJ são normalizados pra só dígitos. Valor aceita vírgula ou ponto.
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
            <span><strong>{rows.length}</strong> fornecedores prontos.</span>
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
            {importando ? 'Importando...' : `✓ Importar ${rows.length} fornecedores`}
          </button>
        </div>
      )}

      {results && totais && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              ✓ Criados: <strong>{totais.ok}</strong>
            </span>
            <span className="px-3 py-1.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              ⊘ Duplicados: <strong>{totais.dup}</strong>
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
                  <li key={i} className="text-red-400"><strong>{r.row.nome}</strong>: {r.msg}</li>
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
            <th className="text-left px-2 py-1.5">Nome</th>
            <th className="text-left px-2 py-1.5">Categoria</th>
            <th className="text-left px-2 py-1.5">Telefone</th>
            <th className="text-left px-2 py-1.5">E-mail</th>
            <th className="text-left px-2 py-1.5">Doc</th>
            <th className="text-left px-2 py-1.5">Valor ref.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5">{r.nome}</td>
              <td className="px-2 py-1.5 capitalize">{r.categoria}</td>
              <td className="px-2 py-1.5 text-slate-400">{r.telefone ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-400">{r.email ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-400">{r.documento ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-400">
                {r.valor_referencia != null ? `R$ ${r.valor_referencia.toFixed(2).replace('.', ',')}` : '—'}
              </td>
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
