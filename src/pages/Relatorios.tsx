import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { listOcorrencias } from '../lib/ocorrencias'
import { listMultas, MULTA_STATUS_LABEL } from '../lib/multas'
import { listEncomendas } from '../lib/encomendas'
import { listChamados } from '../lib/chamados'
import { listCondominios, getCondominio } from '../lib/condominios'
import { listUnidades } from '../lib/unidades'
import type { Condominio } from '../types/condominio'
import { useAuth } from '../components/AuthProvider'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Field, TextInput, Select } from '../components/ui/Input'

type TipoRelatorio = 'ocorrencias' | 'multas' | 'encomendas' | 'chamados'

const TIPO_LABEL: Record<TipoRelatorio, string> = {
  ocorrencias: 'Ocorrências',
  multas: 'Multas',
  encomendas: 'Encomendas',
  chamados: 'Chamados de manutenção',
}

export default function Relatorios() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'admin_onway' && !perfil?.condominio_id

  const [condos, setCondos] = useState<Condominio[]>([])
  const [scopeId, setScopeId] = useState<string>('')
  const [tipo, setTipo] = useState<TipoRelatorio>('multas')
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const [desde, setDesde] = useState(monthAgo)
  const [ate, setAte] = useState(today)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      listCondominios().then((cs) => {
        setCondos(cs)
        if (cs.length && !scopeId) setScopeId(cs[0].id)
      }).catch(() => {})
    } else if (perfil?.condominio_id) {
      setScopeId(perfil.condominio_id)
    }
  }, [isAdmin, perfil, scopeId])

  function inRange(iso: string): boolean {
    const t = new Date(iso).getTime()
    return t >= new Date(desde).getTime() && t <= new Date(ate + 'T23:59:59').getTime()
  }

  async function handleGerar() {
    if (!scopeId) return setError('Selecione o condomínio.')
    setGenerating(true)
    setError(null)
    try {
      const condo = await getCondominio(scopeId)
      const condoNome = condo?.nome ?? 'Condomínio'

      const unidades = await listUnidades({ condominio_id: scopeId })
      const unidLabel = (uid: string | null) => {
        if (!uid) return 'Área comum'
        const u = unidades.find((x) => x.id === uid)
        return u ? (u.bloco ? `${u.bloco}-${u.numero}` : u.numero) : '—'
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      // Cabeçalho
      doc.setFontSize(16)
      doc.text('OnWay Condomínio', 14, 18)
      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(condoNome, 14, 25)
      doc.setFontSize(13)
      doc.setTextColor(0)
      doc.text(`Relatório de ${TIPO_LABEL[tipo]}`, 14, 35)
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(
        `Período: ${new Date(desde).toLocaleDateString('pt-BR')} a ${new Date(ate).toLocaleDateString('pt-BR')}` +
          `  ·  Gerado em ${new Date().toLocaleString('pt-BR')}`,
        14,
        41,
      )

      let head: string[][] = []
      let body: string[][] = []

      if (tipo === 'ocorrencias') {
        const data = (await listOcorrencias({ condominio_id: scopeId })).filter((o) => inRange(o.created_at))
        head = [['Data', 'Unidade', 'Local', 'Descrição', 'Status']]
        body = data.map((o) => [
          new Date(o.created_at).toLocaleDateString('pt-BR'),
          unidLabel(o.unidade_id),
          o.local ?? '—',
          o.descricao.slice(0, 80),
          o.status,
        ])
      } else if (tipo === 'multas') {
        const data = (await listMultas({ condominio_id: scopeId })).filter((m) => inRange(m.created_at))
        head = [['Data', 'Unidade', 'Valor (R$)', 'Status', 'Artigo', 'Descrição']]
        body = data.map((m) => [
          new Date(m.created_at).toLocaleDateString('pt-BR'),
          unidLabel(m.unidade_id),
          Number(m.valor).toFixed(2).replace('.', ','),
          MULTA_STATUS_LABEL[m.status],
          m.artigo_regimento ?? '—',
          m.descricao.slice(0, 60),
        ])
        // Totais
        const total = data.reduce((s, m) => s + Number(m.valor), 0)
        const pagas = data.filter((m) => m.status === 'paga').reduce((s, m) => s + Number(m.valor), 0)
        doc.setFontSize(10)
        doc.setTextColor(0)
        doc.text(`Total no período: R$ ${total.toFixed(2).replace('.', ',')}`, 14, 50)
        doc.text(`Arrecadado (pagas): R$ ${pagas.toFixed(2).replace('.', ',')}`, 14, 55)
      } else if (tipo === 'encomendas') {
        const data = (await listEncomendas({ condominio_id: scopeId })).filter((e) => inRange(e.created_at))
        head = [['Data', 'Unidade', 'Tipo', 'Transportadora', 'Status']]
        body = data.map((e) => [
          new Date(e.created_at).toLocaleDateString('pt-BR'),
          unidLabel(e.unidade_id),
          e.tipo,
          e.transportadora ?? '—',
          e.status,
        ])
      } else if (tipo === 'chamados') {
        const data = (await listChamados({ condominio_id: scopeId })).filter((c) => inRange(c.created_at))
        head = [['Data', 'Unidade', 'Categoria', 'Prioridade', 'Status', 'Título']]
        body = data.map((c) => [
          new Date(c.created_at).toLocaleDateString('pt-BR'),
          unidLabel(c.unidade_id),
          c.categoria,
          c.prioridade,
          c.status,
          c.titulo.slice(0, 50),
        ])
      }

      const startY = tipo === 'multas' ? 62 : 48
      autoTable(doc, {
        startY,
        head,
        body,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didDrawPage: (data) => {
          // Rodapé com paginação
          const pageHeight = doc.internal.pageSize.height
          doc.setFontSize(8)
          doc.setTextColor(150)
          doc.text(
            `Página ${doc.getNumberOfPages()}`,
            data.settings.margin.left,
            pageHeight - 8,
          )
        },
      })

      if (body.length === 0) {
        doc.setFontSize(11)
        doc.setTextColor(120)
        doc.text('Nenhum registro no período.', 14, startY + 4)
      }

      const filename = `${TIPO_LABEL[tipo].toLowerCase().replace(/\s/g, '-')}-${desde}-a-${ate}.pdf`
      doc.save(filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar PDF.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios em PDF do período escolhido."
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-5">
        <Field label="Tipo de relatório" required>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRelatorio)}>
            <option value="multas">Multas</option>
            <option value="ocorrencias">Ocorrências</option>
            <option value="encomendas">Encomendas</option>
            <option value="chamados">Chamados de manutenção</option>
          </Select>
        </Field>

        {isAdmin && condos.length > 0 && (
          <Field label="Condomínio" required>
            <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
              {condos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="De" required>
            <TextInput
              type="date"
              required
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </Field>
          <Field label="Até" required>
            <TextInput
              type="date"
              required
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </Field>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <Button onClick={handleGerar} disabled={generating}>
          {generating ? 'Gerando...' : '📄 Gerar PDF'}
        </Button>
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Os PDFs são gerados localmente no seu navegador (não passam pelo servidor).
      </p>
    </div>
  )
}
