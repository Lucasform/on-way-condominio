// Gera PDF da ata de votacao com totais e resultado.
import type { Votacao, VotacaoOpcao, Voto } from '../types/votacao'
import type { Condominio } from '../types/condominio'
import type { MesaMembro } from '../types/assembleia'

export async function gerarPdfAtaVotacao(args: {
  votacao: Votacao
  opcoes: VotacaoOpcao[]
  votos: Voto[]
  condominio: Condominio | null
  quorumMinimo: number | null
  assinaturaUrl?: string | null
  emissorNome?: string | null
  mesaDiretora?: MesaMembro[]
}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { votacao, opcoes, votos, condominio, quorumMinimo, assinaturaUrl, emissorNome, mesaDiretora } = args

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  let y = 20

  // Cabecalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(condominio?.nome ?? 'Condomínio', 105, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(
    [condominio?.endereco, condominio?.bairro, condominio?.cidade].filter(Boolean).join(' · '),
    105, y + 6, { align: 'center' },
  )
  doc.setTextColor(20)
  y += 18

  doc.setDrawColor(29, 78, 216)
  doc.setLineWidth(0.5)
  doc.line(20, y, W - 20, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ATA DE VOTAÇÃO', 105, y, { align: 'center' })
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`ID: ${votacao.id.slice(0, 8).toUpperCase()}`, 105, y, { align: 'center' })
  y += 10

  // Pergunta
  doc.setFont('helvetica', 'bold')
  doc.text('Pergunta', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  y = bloco(doc, votacao.titulo, 20, y, W - 40, 5)
  y += 4

  if (votacao.descricao) {
    doc.setFont('helvetica', 'bold')
    doc.text('Contexto', 20, y); y += 6
    doc.setFont('helvetica', 'normal')
    y = bloco(doc, votacao.descricao, 20, y, W - 40, 5)
    y += 4
  }

  // Periodo
  doc.setFont('helvetica', 'bold')
  doc.text('Período', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Início: ${fmt(votacao.data_inicio)}`, 20, y); y += 5
  if (votacao.data_fim) { doc.text(`Encerramento: ${fmt(votacao.data_fim)}`, 20, y); y += 5 }
  y += 4

  // Resultados
  doc.setFont('helvetica', 'bold')
  doc.text('Resultado', 20, y); y += 6
  doc.setFont('helvetica', 'normal')

  const totalVotos = votos.length
  doc.text(`Total de votos: ${totalVotos}`, 20, y); y += 5
  const convidados = votos.filter((v) => v.verificado === false).length
  if (votacao.modo === 'qrcode' || convidados > 0) {
    const verificados = totalVotos - convidados
    doc.text(`Verificados (com login): ${verificados}  ·  Convidados (sem login): ${convidados}`, 20, y); y += 5
  }
  if (quorumMinimo != null) {
    const atingiu = totalVotos >= quorumMinimo
    doc.text(`Quórum mínimo: ${quorumMinimo} - ${atingiu ? 'ATINGIDO' : 'NAO ATINGIDO'}`, 20, y)
    y += 5
  }
  y += 3

  const resultados = opcoes
    .map((o) => ({ opcao: o, count: votos.filter((v) => v.opcao_id === o.id).length }))
    .sort((a, b) => b.count - a.count)

  for (const r of resultados) {
    const pct = totalVotos > 0 ? Math.round((r.count / totalVotos) * 100) : 0
    doc.setFont('helvetica', 'bold')
    doc.text(`${r.opcao.texto}`, 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${r.count} voto${r.count !== 1 ? 's' : ''} (${pct}%)`, W - 20, y, { align: 'right' })
    y += 4
    // barra
    doc.setFillColor(225, 225, 225)
    doc.rect(20, y, W - 40, 3, 'F')
    doc.setFillColor(29, 78, 216)
    doc.rect(20, y, ((W - 40) * pct) / 100, 3, 'F')
    y += 8
  }

  const vencedor = resultados[0]
  if (vencedor && vencedor.count > 0) {
    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`Opção vencedora: ${vencedor.opcao.texto}`, 20, y)
    doc.setFontSize(10)
    y += 8
  }

  // Assinaturas — mesa diretora + síndico
  await renderizarAssinaturas(doc, {
    y,
    W,
    H,
    mesaDiretora: mesaDiretora ?? [],
    assinaturaUrl: assinaturaUrl ?? null,
    emissorNome: emissorNome ?? null,
    condominioNome: condominio?.nome ?? '',
  })

  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text(
    `Documento gerado pelo OnWay Condomínio · ${fmt(new Date().toISOString())}`,
    105, H - 12, { align: 'center' },
  )

  doc.save(`ata-votacao-${votacao.id.slice(0, 8)}.pdf`)
}

// ============================================================
// Renderiza colunas de assinatura (mesa + síndico)
// ============================================================

const CARGO_LABEL: Record<string, string> = {
  presidente_mesa: 'Presidente da Mesa',
  secretario: 'Secretário(a)',
  coordenador: 'Coordenador(a) da Assembleia',
  outro: 'Participante',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderizarAssinaturas(
  doc: any,
  opts: {
    y: number
    W: number
    H: number
    mesaDiretora: MesaMembro[]
    assinaturaUrl: string | null
    emissorNome: string | null
    condominioNome: string
  },
): Promise<void> {
  const { W, H, mesaDiretora, assinaturaUrl, emissorNome, condominioNome } = opts

  // Síndico sempre aparece como último bloco
  const sindico: MesaMembro = {
    nome: emissorNome ?? 'Síndico',
    cpf: '',
    cargo: 'outro',
    assinatura_url: assinaturaUrl ?? null,
  }
  sindico.cargo = 'outro'

  const membros: MesaMembro[] = mesaDiretora.length > 0
    ? [...mesaDiretora, { ...sindico, cargo: 'outro' }]
    : [sindico]

  // Ao máximo 3 colunas por linha
  const MAX_COL = 3
  const linhas: MesaMembro[][] = []
  for (let i = 0; i < membros.length; i += MAX_COL) {
    linhas.push(membros.slice(i, i + MAX_COL))
  }

  // Área de assinaturas: última linha começa a ~60mm do rodapé
  const ALTURA_BLOCO = 28 // mm por bloco de assinatura
  const totalAltura = linhas.length * ALTURA_BLOCO
  let startY = Math.max(opts.y + 14, H - 20 - totalAltura)

  const MARGIN = 20

  // Separador
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, startY - 4, W - MARGIN, startY - 4)
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text('Assinaturas', MARGIN, startY - 1)
  doc.setTextColor(20)

  for (const linha of linhas) {
    const n = linha.length
    const colW = (W - MARGIN * 2) / n

    for (let c = 0; c < n; c++) {
      const membro = linha[c]
      const cx = MARGIN + c * colW + colW / 2
      let by = startY + 6

      if (membro.assinatura_url) {
        try {
          const ass = await carregarImagem(membro.assinatura_url)
          const maxW = 42, maxH = 14
          const ratio = ass.width / ass.height
          let iw = maxW, ih = maxW / ratio
          if (ih > maxH) { ih = maxH; iw = maxH * ratio }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(doc as any).addImage(ass.dataUrl, ass.format, cx - iw / 2, by - ih, iw, ih)
          by += 2
        } catch { /* sem imagem — linha em branco */ }
      } else {
        by += 12 // espaço para assinatura manual
      }

      // Linha de assinatura
      doc.setDrawColor(100)
      doc.setLineWidth(0.3)
      doc.line(cx - colW * 0.4, by, cx + colW * 0.4, by)
      by += 4

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(membro.nome, cx, by, { align: 'center', maxWidth: colW - 4 })
      by += 4

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(80)

      if (c === n - 1 && mesaDiretora.length === 0) {
        // coluna única = síndico
        doc.text('Síndico', cx, by, { align: 'center' })
        by += 3
        doc.text(condominioNome, cx, by, { align: 'center', maxWidth: colW - 4 })
      } else if (c === n - 1 && mesaDiretora.length > 0) {
        doc.text('Síndico', cx, by, { align: 'center' })
        by += 3
        if (membro.cpf) doc.text(`CPF: ${membro.cpf}`, cx, by, { align: 'center' })
      } else {
        const cargoLabel = CARGO_LABEL[membro.cargo] ?? membro.cargo
        doc.text(cargoLabel, cx, by, { align: 'center' })
        by += 3
        if (membro.cpf) doc.text(`CPF: ${membro.cpf}`, cx, by, { align: 'center' })
      }

      doc.setTextColor(20)
    }

    startY += ALTURA_BLOCO
  }
}

// ============================================================
// Helpers
// ============================================================

function bloco(
  doc: { splitTextToSize: (s: string, w: number) => string[]; text: (s: string | string[], x: number, y: number) => void },
  texto: string, x: number, y: number, larg: number, lineH: number,
): number {
  const linhas = doc.splitTextToSize(texto, larg)
  doc.text(linhas, x, y)
  return y + linhas.length * lineH
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

async function carregarImagem(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number }> {
  const resp = await fetch(url)
  const blob = await resp.blob()
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(blob)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = dataUrl
  })
  const format = blob.type.includes('png') || blob.type.includes('svg') ? 'PNG' : 'JPEG'
  return { dataUrl, format, width: img.naturalWidth, height: img.naturalHeight }
}
