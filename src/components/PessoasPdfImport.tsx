import { useState } from 'react'
import { supabase } from '../lib/supabase'
import PdfAiImport from './PdfAiImport'
import Button from './ui/Button'
import type { PdfExtractResult, PdfPessoa } from '../lib/pdfAi'

interface Props {
  condominio_id: string
  onDone?: () => void
}

interface PessoaResult {
  pessoa: PdfPessoa
  status: 'pendente' | 'ok' | 'erro' | 'dup'
  msg?: string
}

const TIPOS_VALIDOS = ['titular', 'conjuge', 'filho', 'dependente', 'inquilino', 'funcionario', 'outro']

export default function PessoasPdfImport({ condominio_id, onDone }: Props) {
  const [pessoas, setPessoas] = useState<PdfPessoa[]>([])
  const [results, setResults] = useState<PessoaResult[] | null>(null)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleExtracted(result: PdfExtractResult) {
    const data = result.extracted as { pessoas?: PdfPessoa[] }
    const lista = data?.pessoas ?? []
    if (!lista.length) {
      setError('A IA não encontrou pessoas neste documento. Verifique o PDF e tente novamente.')
      return
    }
    setPessoas(lista.filter((p) => p.nome?.trim()))
    setResults(null)
    setError(null)
  }

  async function importar() {
    setImportando(true)
    const res: PessoaResult[] = pessoas.map((p) => ({ pessoa: p, status: 'pendente' }))

    try {
      // Mapa de unidades por bloco+numero para resolver unidade_id
      const { data: unidades } = await supabase
        .from('unidades')
        .select('id, bloco, numero')
        .eq('condominio_id', condominio_id)

      // Mapa de CPFs existentes para detectar duplicatas
      const { data: existentes } = await supabase
        .from('pessoas')
        .select('cpf, email')
        .eq('condominio_id', condominio_id)

      const cpfIdx = new Set((existentes ?? []).map((p) => p.cpf).filter(Boolean))
      const emailIdx = new Set((existentes ?? []).map((p) => p.email).filter(Boolean))

      for (let i = 0; i < pessoas.length; i++) {
        const p = pessoas[i]
        try {
          const cpf = p.cpf?.replace(/\D/g, '') || null
          const email = p.email?.toLowerCase().trim() || null

          if (cpf && cpfIdx.has(cpf)) {
            res[i] = { pessoa: p, status: 'dup', msg: 'CPF já cadastrado' }
            setResults([...res])
            continue
          }
          if (email && emailIdx.has(email)) {
            res[i] = { pessoa: p, status: 'dup', msg: 'E-mail já cadastrado' }
            setResults([...res])
            continue
          }

          // Encontra unidade_id se fornecida
          let unidade_id: string | null = null
          if (p.unidade_numero && unidades) {
            const num = p.unidade_numero.trim()
            const bloco = (p.bloco ?? '').trim().toUpperCase()
            const found = unidades.find((u) => {
              const matchNum = u.numero.trim() === num
              const matchBloco = !bloco || (u.bloco ?? '').trim().toUpperCase() === bloco
              return matchNum && matchBloco
            })
            unidade_id = found?.id ?? null
          }

          const tipoVinculo = TIPOS_VALIDOS.includes(p.tipo_vinculo ?? '') ? p.tipo_vinculo : 'outro'

          const { error: err } = await supabase.from('pessoas').insert({
            condominio_id,
            unidade_id,
            nome: p.nome.trim(),
            cpf: cpf || null,
            email: email || null,
            telefone: p.telefone?.replace(/\D/g, '') || null,
            tipo_vinculo: tipoVinculo,
            ativo: true,
          })

          if (err) throw err
          if (cpf) cpfIdx.add(cpf)
          if (email) emailIdx.add(email)
          res[i] = { pessoa: p, status: 'ok' }
        } catch (e) {
          res[i] = {
            pessoa: p,
            status: 'erro',
            msg: e instanceof Error ? e.message : 'Erro desconhecido',
          }
        }
        setResults([...res])
      }
    } finally {
      setImportando(false)
      onDone?.()
    }
  }

  const totais = results
    ? {
        ok: results.filter((r) => r.status === 'ok').length,
        dup: results.filter((r) => r.status === 'dup').length,
        erro: results.filter((r) => r.status === 'erro').length,
      }
    : null

  return (
    <fieldset className="border border-amber-500/30 rounded-md p-4 space-y-4 bg-amber-500/3">
      <legend className="px-2 text-sm font-semibold text-amber-300">
        ✨ Importar moradores via PDF com IA
      </legend>
      <p className="text-xs text-slate-400 -mt-2">
        Suba uma ficha cadastral, contrato ou lista de moradores em PDF. A IA extrai nome, CPF, e-mail, telefone e unidade automaticamente.
      </p>

      {!pessoas.length && !results && (
        <PdfAiImport
          context="pessoas"
          onExtracted={handleExtracted}
          disabled={importando}
        />
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {pessoas.length > 0 && !results && (
        <div className="space-y-3">
          <div className="text-sm text-slate-300 flex items-baseline justify-between">
            <span><strong>{pessoas.length}</strong> pessoas identificadas pela IA.</span>
            <button
              type="button"
              onClick={() => { setPessoas([]); setResults(null); setError(null) }}
              className="text-xs text-slate-500 hover:underline"
            >
              Limpar
            </button>
          </div>
          <div className="overflow-x-auto border border-slate-700 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/60 text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-2 py-1.5">Nome</th>
                  <th className="text-left px-2 py-1.5">Unidade</th>
                  <th className="text-left px-2 py-1.5">Vínculo</th>
                  <th className="text-left px-2 py-1.5">E-mail</th>
                  <th className="text-left px-2 py-1.5">CPF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {pessoas.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5 font-medium text-slate-200">{p.nome}</td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {p.bloco ? `${p.bloco}-` : ''}{p.unidade_numero ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 capitalize text-slate-400">{p.tipo_vinculo ?? '—'}</td>
                    <td className="px-2 py-1.5 text-slate-400">{p.email ?? '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-400">{p.cpf ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pessoas.length > 8 && (
              <div className="px-2 py-1.5 text-xs text-slate-500 bg-slate-900/30">
                ...e mais {pessoas.length - 8} pessoas.
              </div>
            )}
          </div>
          <Button type="button" onClick={importar} disabled={importando}>
            {importando ? 'Importando...' : `✓ Importar ${pessoas.length} pessoas`}
          </Button>
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
          <button
            type="button"
            onClick={() => { setPessoas([]); setResults(null); setError(null) }}
            className="text-sm text-amber-400 hover:underline"
          >
            Importar outro PDF
          </button>
        </div>
      )}
    </fieldset>
  )
}
