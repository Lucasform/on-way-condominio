// Gera PDF de notificação de multa em layout padrão A4.
// Lazy-load do jspdf pra não inflar o bundle inicial.
import type { Multa } from '../types/multa'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'

export async function gerarPdfNotificacao(args: {
  multa: Multa
  unidade: Unidade | null
  pessoa: Pessoa | null
  condominio: Condominio
  assinaturaUrl?: string | null
  emissorNome?: string | null
}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { multa, unidade, pessoa, condominio, assinaturaUrl, emissorNome } = args

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  let y = 20

  // Cabeçalho com logo (se houver)
  if (condominio.logo_url) {
    try {
      const img = await carregarImagem(condominio.logo_url)
      const ratio = img.width / img.height
      const h = 22
      const w = h * ratio
      doc.addImage(img.dataUrl, img.format, 20, y - 5, w, h)
    } catch { /* ignora se logo falhar */ }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(condominio.nome, 105, y + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(
    [condominio.endereco, condominio.bairro, condominio.cidade && `${condominio.cidade}/${condominio.estado ?? ''}`]
      .filter(Boolean)
      .join(' · '),
    105, y + 11, { align: 'center' },
  )
  if (condominio.cnpj) {
    doc.text(`CNPJ: ${formatarCNPJ(condominio.cnpj)}`, 105, y + 16, { align: 'center' })
  }
  doc.setTextColor(20)

  y += 30
  doc.setDrawColor(139, 20, 36) // brand 700
  doc.setLineWidth(0.5)
  doc.line(20, y, W - 20, y)
  y += 8

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('NOTIFICAÇÃO DE INFRAÇÃO', 105, y, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nº ${multa.id.slice(0, 8).toUpperCase()} · ${fmtData(multa.created_at)}`, 105, y + 6, { align: 'center' })
  y += 16

  // Destinatário
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Destinatário', 20, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  y += 6
  const unidadeLabel = unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'
  doc.text(`Nome: ${pessoa?.nome ?? '(à unidade)'}`, 20, y); y += 5
  doc.text(`Unidade: ${unidadeLabel}`, 20, y); y += 5
  if (pessoa?.cpf) { doc.text(`CPF: ${formatarCPF(pessoa.cpf)}`, 20, y); y += 5 }

  y += 6

  // Descrição
  doc.setFont('helvetica', 'bold')
  doc.text('Descrição da infração', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  y = escreverBloco(doc, multa.descricao || '—', 20, y, W - 40, 5)

  y += 4

  // Base legal
  if (multa.artigo_regimento) {
    doc.setFont('helvetica', 'bold')
    doc.text('Base no regimento interno', 20, y); y += 6
    doc.setFont('helvetica', 'normal')
    y = escreverBloco(doc, multa.artigo_regimento, 20, y, W - 40, 5)
    y += 4
  }

  // Valor
  doc.setFillColor(253, 242, 243)
  doc.rect(20, y, W - 40, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(139, 20, 36)
  doc.text('Valor da multa', 25, y + 7)
  doc.setFontSize(16)
  doc.text(`R$ ${Number(multa.valor).toFixed(2).replace('.', ',')}`, W - 25, y + 12, { align: 'right' })
  doc.setTextColor(20)
  doc.setFont('helvetica', 'normal')
  y += 24

  // Texto institucional
  doc.setFontSize(10)
  const corpo = [
    'Comunicamos que foi registrada a infração descrita acima, conforme apuração da administração condominial.',
    'A multa deverá ser quitada no próximo boleto condominial. Em caso de discordância, o(a) condômino(a) pode apresentar contestação no prazo de 30 (trinta) dias contados da ciência desta notificação, conforme convenção interna.',
    'Para apresentar contestação, acesse a área do morador no aplicativo OnWay Condomínio ou entre em contato com a administração.',
  ]
  for (const p of corpo) {
    y = escreverBloco(doc, p, 20, y, W - 40, 5)
    y += 3
  }

  // Assinatura — embedda imagem se houver
  y = Math.max(y + 14, H - 55)
  if (assinaturaUrl) {
    try {
      const ass = await carregarImagem(assinaturaUrl)
      // Centraliza acima da linha, max 50mm de largura e 18mm de altura
      const maxW = 50, maxH = 18
      const ratio = ass.width / ass.height
      let w = maxW, h = maxW / ratio
      if (h > maxH) { h = maxH; w = maxH * ratio }
      doc.addImage(ass.dataUrl, ass.format, 105 - w / 2, y - h, w, h)
    } catch { /* ignora se assinatura falhar */ }
  }
  doc.setDrawColor(150)
  doc.line(60, y, W - 60, y)
  doc.setFontSize(10)
  doc.text(emissorNome ?? 'Síndico', 105, y + 5, { align: 'center' })
  doc.text(condominio.nome, 105, y + 10, { align: 'center' })
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(`Emitido em ${fmtData(new Date().toISOString())}`, 105, y + 14, { align: 'center' })
  doc.setTextColor(20)
  doc.setFontSize(10)

  // Rodapé
  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text(
    `Documento gerado eletronicamente pelo OnWay Condomínio · ${fmtData(new Date().toISOString())} · ID ${multa.id}`,
    105, H - 12, { align: 'center' },
  )

  const nome = `notificacao-${unidadeLabel}-${multa.id.slice(0, 8)}.pdf`
  doc.save(nome)
}

// ============================================================
// Helpers
// ============================================================

function escreverBloco(
  doc: { splitTextToSize: (s: string, w: number) => string[]; text: (s: string | string[], x: number, y: number) => void },
  texto: string, x: number, y: number, larg: number, lineH: number,
): number {
  const linhas = doc.splitTextToSize(texto, larg)
  doc.text(linhas, x, y)
  return y + linhas.length * lineH
}

function fmtData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

function formatarCPF(d: string): string {
  if (d.length !== 11) return d
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatarCNPJ(d: string): string {
  if (d.length !== 14) return d
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
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
