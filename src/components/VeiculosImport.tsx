import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'
import {
  applyHeaderMap,
  digitsOrNull,
  gerarXlsxModelo,
  msgErroImport,
  parseTabularFile,
} from '../lib/importHelpers'

interface Props {
  condominio_id: string
  onDone?: () => void
}

interface Row {
  placa: string
  modelo: string | null
  cor: string | null
  tipo: string
  vaga: string | null
  bloco: string | null
  numero: string | null
  cpf: string | null
  pessoa_nome: string | null
}

interface RowResult {
  row: Row
  status: 'ok' | 'dup' | 'erro' | 'pendente'
  msg?: string
}

const TIPOS_VALIDOS = ['carro', 'moto', 'bicicleta', 'utilitario', 'outro']

const HEADER_MAP: Record<string, keyof Row> = {
  placa: 'placa',
  modelo: 'modelo', marca: 'modelo', veiculo: 'modelo',
  cor: 'cor',
  tipo: 'tipo', categoria: 'tipo',
  vaga: 'vaga', estacionamento: 'vaga',
  bloco: 'bloco', torre: 'bloco', predio: 'bloco', edificio: 'bloco',
  numero: 'numero', número: 'numero', n: 'numero',
  apto: 'numero', apartamento: 'numero', unidade: 'numero',
  cpf: 'cpf',
  pessoa: 'pessoa_nome', nome: 'pessoa_nome', proprietario: 'pessoa_nome', morador: 'pessoa_nome',
}

function normalizaPlaca(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export default function VeiculosImport({ condominio_id, onDone }: Props) {
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
          const placa = normalizaPlaca(r.placa)
          if (!placa) return null
          const tipoRaw = (r.tipo ?? 'carro').toString().toLowerCase()
          return {
            placa,
            modelo: r.modelo?.toString().trim() || null,
            cor: r.cor?.toString().trim() || null,
            tipo: TIPOS_VALIDOS.includes(tipoRaw) ? tipoRaw : 'carro',
            vaga: r.vaga?.toString().trim() || null,
            bloco: r.bloco?.toString().trim() || null,
            numero: r.numero?.toString().trim() || null,
            cpf: digitsOrNull(r.cpf as string | null | undefined),
            pessoa_nome: r.pessoa_nome?.toString().trim() || null,
          } as Row
        })
        .filter((r): r is Row => r !== null)
      setRows(parsed)
      if (!parsed.length) {
        setError('Nenhuma linha válida. Confira se a coluna "placa" existe.')
      }
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
      // Indices auxiliares
      const [{ data: uniData }, { data: pessoasData }, { data: veiData }] = await Promise.all([
        supabase.from('unidades').select('id, bloco, numero').eq('condominio_id', condominio_id),
        supabase.from('pessoas').select('id, nome, cpf, unidade_id').eq('condominio_id', condominio_id),
        supabase.from('veiculos').select('id, placa').eq('condominio_id', condominio_id),
      ])
      const unidadePorChave = new Map<string, string>()
      for (const u of uniData ?? []) {
        unidadePorChave.set(chaveUnidade(u.bloco, u.numero), u.id)
      }
      const pessoaPorCpf = new Map<string, { id: string; unidade_id: string | null }>()
      const pessoaPorNome = new Map<string, { id: string; unidade_id: string | null }>()
      for (const p of pessoasData ?? []) {
        if (p.cpf) pessoaPorCpf.set(p.cpf, { id: p.id, unidade_id: p.unidade_id })
        pessoaPorNome.set(normalizaNome(p.nome), { id: p.id, unidade_id: p.unidade_id })
      }
      const placasExistentes = new Set<string>()
      for (const v of veiData ?? []) placasExistentes.add(normalizaPlaca(v.placa))

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
          if (placasExistentes.has(r.placa)) {
            res[i] = { row: r, status: 'dup', msg: 'placa já cadastrada' }
            setResults([...res])
            continue
          }

          // resolve pessoa
          let pessoa_id: string | null = null
          let unidadeDaPessoa: string | null = null
          if (r.cpf && pessoaPorCpf.has(r.cpf)) {
            const p = pessoaPorCpf.get(r.cpf)!
            pessoa_id = p.id
            unidadeDaPessoa = p.unidade_id
          } else if (r.pessoa_nome) {
            const p = pessoaPorNome.get(normalizaNome(r.pessoa_nome))
            if (p) { pessoa_id = p.id; unidadeDaPessoa = p.unidade_id }
          }

          // resolve unidade: prioridade Bloco+Numero da planilha, depois unidade da pessoa
          let unidade_id: string | null = null
          if (r.numero) {
            unidade_id = unidadePorChave.get(chaveUnidade(r.bloco, r.numero)) ?? null
            if (!unidade_id) {
              res[i] = { row: r, status: 'erro', msg: `unidade ${r.bloco ? r.bloco + '-' : ''}${r.numero} não encontrada` }
              setResults([...res])
              continue
            }
          } else if (unidadeDaPessoa) {
            unidade_id = unidadeDaPessoa
          }

          if (!unidade_id) {
            res[i] = { row: r, status: 'erro', msg: 'unidade não informada (use colunas bloco+numero ou cpf/pessoa)' }
            setResults([...res])
            continue
          }

          const { error: uErr } = await supabase.from('veiculos').insert({
            condominio_id,
            unidade_id,
            pessoa_id,
            placa: r.placa,
            modelo: r.modelo,
            cor: r.cor,
            tipo: r.tipo,
            vaga: r.vaga,
            ativo: true,
          })
          if (uErr) throw uErr
          placasExistentes.add(r.placa)
          res[i] = { row: r, status: 'ok' }
        } catch (e) {
          res[i] = { row: r, status: 'erro', msg: msgErroImport(e) }
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
      'modelo-import-veiculos.xlsx',
      'Veiculos',
      ['placa', 'modelo', 'cor', 'tipo', 'vaga', 'bloco', 'numero', 'cpf', 'pessoa'],
      [
        ['ABC1D23', 'Honda Civic', 'Preto',   'carro',     'V12', 'A', '101', '12345678901', 'João Silva'],
        ['XYZ9W87', 'Honda CB300', 'Vermelha','moto',      'M02', 'A', '101', '',            'João Silva'],
        ['DEF4G56', 'Fiat Toro',   'Branco',  'utilitario','V07', 'B', '201', '',            'Maria Souza'],
      ],
      [10, 18, 10, 12, 8, 8, 8, 14, 18],
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
        🚗 Importar veículos em massa
      </legend>
      <p className="text-xs text-slate-400 -mt-2">
        Aceita CSV ou XLSX. Placas já cadastradas são ignoradas. A unidade pode vir das colunas
        <strong> bloco + numero</strong> da planilha, ou ser deduzida pelo <strong>CPF</strong> ou <strong>nome</strong> da pessoa.
        Tipos válidos: carro, moto, bicicleta, utilitario, outro.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={parsing || importando}>
          {parsing ? 'Lendo...' : '📂 Escolher arquivo'}
        </Button>
        <Button type="button" variant="secondary" onClick={baixarTemplate}>
          ⬇ Baixar modelo
        </Button>
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
            <span><strong>{rows.length}</strong> veículos prontos pra importar.</span>
            <button
              type="button"
              onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = '' }}
              className="text-xs text-slate-500 hover:underline"
            >
              Limpar
            </button>
          </div>
          <Preview rows={rows} max={6} />
          <Button type="button" onClick={importar} disabled={importando} className="mt-3">
            {importando ? 'Importando...' : `✓ Importar ${rows.length} veículos`}
          </Button>
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
                  <li key={i} className="text-red-400">
                    <strong>{r.row.placa}</strong>: {r.msg}
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
            <th className="text-left px-2 py-1.5">Placa</th>
            <th className="text-left px-2 py-1.5">Modelo</th>
            <th className="text-left px-2 py-1.5">Cor</th>
            <th className="text-left px-2 py-1.5">Tipo</th>
            <th className="text-left px-2 py-1.5">Vaga</th>
            <th className="text-left px-2 py-1.5">Unidade</th>
            <th className="text-left px-2 py-1.5">Pessoa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5 font-mono">{r.placa}</td>
              <td className="px-2 py-1.5">{r.modelo ?? '—'}</td>
              <td className="px-2 py-1.5">{r.cor ?? '—'}</td>
              <td className="px-2 py-1.5 capitalize">{r.tipo}</td>
              <td className="px-2 py-1.5 text-slate-400">{r.vaga ?? '—'}</td>
              <td className="px-2 py-1.5 text-slate-400">
                {r.numero ? `${r.bloco ? r.bloco + '-' : ''}${r.numero}` : '—'}
              </td>
              <td className="px-2 py-1.5 text-slate-400">{r.pessoa_nome ?? (r.cpf ? `CPF ${r.cpf}` : '—')}</td>
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

function chaveUnidade(bloco: string | null, numero: string | null): string {
  return `${(bloco ?? '').trim().toUpperCase()}|${(numero ?? '').trim()}`
}

function normalizaNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}
