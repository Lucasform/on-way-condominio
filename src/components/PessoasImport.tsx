import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { msgErroImport } from '../lib/importHelpers'
import { criarImportBatch, setImportBatchTotal } from '../lib/importBatches'
import { useAuth } from './AuthProvider'
import ImportUndoButton from './ImportUndoButton'
import Button from './ui/Button'

interface Props {
  condominio_id: string
  onDone?: () => void
}

interface Row {
  nome: string
  email: string | null
  cpf: string | null
  telefone: string | null
  data_nascimento: string | null
  bloco: string | null
  numero: string | null
  tipo_vinculo: string
  relacao_unidade: string | null
}

interface RowResult {
  row: Row
  status: 'ok' | 'dup' | 'erro' | 'pendente'
  msg?: string
}

const TIPOS_VINCULO = ['titular', 'conjuge', 'filho', 'dependente', 'inquilino', 'funcionario', 'morador', 'outro']
const HEADER_MAP: Record<string, keyof Row> = {
  nome: 'nome', name: 'nome',
  email: 'email', 'e-mail': 'email',
  cpf: 'cpf',
  telefone: 'telefone', celular: 'telefone', phone: 'telefone',
  'data_nascimento': 'data_nascimento', nascimento: 'data_nascimento', 'data de nascimento': 'data_nascimento',
  bloco: 'bloco',
  numero: 'numero', número: 'numero', unidade: 'numero', apto: 'numero', apartamento: 'numero',
  'tipo_vinculo': 'tipo_vinculo', vinculo: 'tipo_vinculo', vínculo: 'tipo_vinculo', tipo: 'tipo_vinculo',
  'relacao_unidade': 'relacao_unidade', relacao: 'relacao_unidade', relação: 'relacao_unidade',
}

export default function PessoasImport({ condominio_id, onDone }: Props) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [results, setResults] = useState<RowResult[] | null>(null)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [undoTick, setUndoTick] = useState(0)

  async function parseArquivo(file: File) {
    setError(null)
    setParsing(true)
    setResults(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let dados: Record<string, string>[]
      if (ext === 'csv' || file.type.includes('csv')) {
        dados = await parseCsv(file)
      } else {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        dados = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, string>[]
      }
      const parsed = dados.map(mapearLinha).filter((r): r is Row => r !== null)
      setRows(parsed)
      if (!parsed.length) setError('Nenhuma linha válida encontrada. Confira se a coluna "nome" existe.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ler arquivo.')
    } finally {
      setParsing(false)
    }
  }

  function mapearLinha(raw: Record<string, string>): Row | null {
    const r: Partial<Row> = { tipo_vinculo: 'morador' }
    for (const [key, val] of Object.entries(raw)) {
      const norm = key.trim().toLowerCase().replace(/\s+/g, '_')
      const target = HEADER_MAP[norm] ?? HEADER_MAP[norm.replace(/_/g, ' ')]
      if (target) (r as Record<string, string>)[target] = String(val ?? '').trim()
    }
    if (!r.nome) return null
    return {
      nome: r.nome,
      email: r.email || null,
      cpf: r.cpf ? r.cpf.replace(/\D/g, '') : null,
      telefone: r.telefone ? r.telefone.replace(/\D/g, '') : null,
      data_nascimento: r.data_nascimento ? normalizarData(r.data_nascimento) : null,
      bloco: r.bloco || null,
      numero: r.numero || null,
      tipo_vinculo: TIPOS_VINCULO.includes((r.tipo_vinculo ?? 'morador').toLowerCase())
        ? (r.tipo_vinculo ?? 'morador').toLowerCase()
        : 'morador',
      relacao_unidade: r.relacao_unidade || null,
    }
  }

  async function importar() {
    if (!user) { setError('Faça login pra importar.'); return }
    setImportando(true)
    setError(null)
    const res: RowResult[] = rows.map((r) => ({ row: r, status: 'pendente' }))
    let batchId: string | null = null
    let total = 0
    try {
      batchId = await criarImportBatch({ condominio_id, user_id: user.id, tipo: 'pessoas' })

      // Carrega unidades existentes pra resolver Bloco-Numero → unidade_id
      const { data: unidadesExist } = await supabase
        .from('unidades')
        .select('id, bloco, numero')
        .eq('condominio_id', condominio_id)
      const idxUnidade = new Map<string, string>()
      for (const u of unidadesExist ?? []) {
        idxUnidade.set(chaveUnidade(u.bloco, u.numero), u.id)
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
          let unidade_id: string | null = null
          if (r.numero) {
            const ch = chaveUnidade(r.bloco, r.numero)
            unidade_id = idxUnidade.get(ch) ?? null
            if (!unidade_id) {
              // Cria unidade
              const { data: nu, error: uErr } = await supabase
                .from('unidades')
                .insert({ condominio_id, bloco: r.bloco, numero: r.numero, tipo: 'apartamento' })
                .select('id')
                .single()
              if (uErr) throw uErr
              unidade_id = nu!.id as string
              idxUnidade.set(ch, unidade_id!)
            }
          }

          // Detecta duplicado por CPF ou email
          if (r.cpf || r.email) {
            const { data: dup } = await supabase
              .from('pessoas')
              .select('id')
              .eq('condominio_id', condominio_id)
              .or([r.cpf ? `cpf.eq.${r.cpf}` : null, r.email ? `email.eq.${r.email}` : null].filter(Boolean).join(','))
              .limit(1)
              .maybeSingle()
            if (dup) {
              res[i] = { row: r, status: 'dup', msg: 'já existe (CPF ou e-mail)' }
              setResults([...res])
              continue
            }
          }

          const { error: pErr } = await supabase.from('pessoas').insert({
            condominio_id,
            unidade_id,
            nome: r.nome,
            email: r.email,
            cpf: r.cpf,
            telefone: r.telefone,
            data_nascimento: r.data_nascimento,
            tipo_vinculo: r.tipo_vinculo,
            relacao_unidade: r.relacao_unidade,
            ativo: true,
            import_batch_id: batchId,
          })
          if (pErr) throw pErr
          res[i] = { row: r, status: 'ok' }
          total++
        } catch (e) {
          res[i] = { row: r, status: 'erro', msg: msgErroImport(e) }
        }
        setResults([...res])
      }
    } finally {
      if (batchId && total > 0) {
        try { await setImportBatchTotal(batchId, total) } catch { /* noop */ }
      }
      setImportando(false)
      setUndoTick((t) => t + 1)
      onDone?.()
    }
  }

  async function baixarTemplate() {
    const XLSX = await import('xlsx')
    const headers = ['nome', 'email', 'cpf', 'telefone', 'data_nascimento', 'bloco', 'numero', 'tipo_vinculo', 'relacao_unidade']
    const exemplos = [
      ['João Silva',  'joao@email.com',  '12345678901', '11999990000', '1985-04-12', 'A', '101', 'titular',    'proprietario'],
      ['Maria Souza', 'maria@email.com', '',            '11988880000', '1990-08-22', 'A', '101', 'conjuge',    'proprietario'],
      ['Pedro Lima',  'pedro@email.com', '',            '',            '',           'B', '201', 'inquilino',  'inquilino'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exemplos])
    // Largura das colunas pra ficar legível
    ws['!cols'] = [
      { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 8 },  { wch: 8 },  { wch: 14 }, { wch: 16 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Moradores')
    XLSX.writeFile(wb, 'modelo-import-moradores.xlsx')
  }

  const totais = results
    ? {
        ok: results.filter((r) => r.status === 'ok').length,
        dup: results.filter((r) => r.status === 'dup').length,
        erro: results.filter((r) => r.status === 'erro').length,
      }
    : null

  return (
    <fieldset className="border border-slate-200 dark:border-slate-700 rounded-md p-4 space-y-4">
      <legend className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Importar moradores em massa
      </legend>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
        Aceita CSV ou XLSX. Cria unidades automaticamente quando "Bloco-Número" não existir.
        Linhas duplicadas (mesmo CPF ou e-mail) são ignoradas.
      </p>

      <ImportUndoButton
        condominio_id={condominio_id}
        tipo="pessoas"
        refreshKey={undoTick}
      />

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
          className="px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          ⬇ Baixar modelo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && parseArquivo(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {rows.length > 0 && !results && (
        <div>
          <div className="text-sm text-slate-700 dark:text-slate-300 mb-2 flex items-baseline justify-between">
            <span><strong>{rows.length}</strong> linhas prontas pra importar.</span>
            <button
              type="button"
              onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = '' }}
              className="text-xs text-slate-500 hover:underline"
            >
              Limpar
            </button>
          </div>
          <PreviewTabela rows={rows} max={6} />
          <Button
            type="button"
            onClick={importar}
            disabled={importando}
            className="mt-3"
          >
            {importando ? 'Importando...' : `✓ Importar ${rows.length} linhas`}
          </Button>
        </div>
      )}

      {results && totais && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              ✓ Criados: <strong>{totais.ok}</strong>
            </span>
            <span className="px-3 py-1.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              ⊘ Duplicados: <strong>{totais.dup}</strong>
            </span>
            <span className="px-3 py-1.5 rounded bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30">
              ✗ Erros: <strong>{totais.erro}</strong>
            </span>
          </div>
          {totais.erro > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-600 dark:text-slate-400">Ver erros</summary>
              <ul className="mt-2 space-y-1">
                {results.filter((r) => r.status === 'erro').map((r, i) => (
                  <li key={i} className="text-red-600 dark:text-red-400">
                    <strong>{r.row.nome}</strong>: {r.msg}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={() => { setRows([]); setResults(null); if (inputRef.current) inputRef.current.value = '' }}
            className="text-sm text-brand-700 dark:text-brand-400 hover:underline"
          >
            Importar outro arquivo
          </button>
        </div>
      )}
    </fieldset>
  )
}

function PreviewTabela({ rows, max }: { rows: Row[]; max: number }) {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase">
          <tr>
            <th className="text-left px-2 py-1.5">Nome</th>
            <th className="text-left px-2 py-1.5">E-mail</th>
            <th className="text-left px-2 py-1.5">CPF</th>
            <th className="text-left px-2 py-1.5">Telefone</th>
            <th className="text-left px-2 py-1.5">Unidade</th>
            <th className="text-left px-2 py-1.5">Vínculo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5">{r.nome}</td>
              <td className="px-2 py-1.5 text-slate-500">{r.email ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-500">{r.cpf ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-500">{r.telefone ?? '—'}</td>
              <td className="px-2 py-1.5">{r.bloco ? `${r.bloco}-` : ''}{r.numero ?? '—'}</td>
              <td className="px-2 py-1.5 capitalize">{r.tipo_vinculo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > max && (
        <div className="px-2 py-1.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/30">
          ...e mais {rows.length - max} linhas.
        </div>
      )}
    </div>
  )
}

function chaveUnidade(bloco: string | null, numero: string | null): string {
  return `${(bloco ?? '').trim().toUpperCase()}|${(numero ?? '').trim()}`
}

function normalizarData(s: string): string | null {
  // Aceita YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  const m2 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m2) {
    const ano = m2[3].length === 2 ? `20${m2[3]}` : m2[3]
    return `${ano}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`
  }
  return null
}

async function parseCsv(file: File): Promise<Record<string, string>[]> {
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const headers = parseCsvLine(lines[0], sep)
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line, sep)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
    return obj
  })
}

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === sep) { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}
