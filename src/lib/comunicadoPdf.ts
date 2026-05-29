// PDF do comunicado oficial. Layout: header com logo+condo, titulo,
// data, corpo do comunicado (texto polido pela IA), assinatura.
import type { Comunicado } from '../types/comunicado'
import type { Condominio } from '../types/condominio'

export async function gerarPdfComunicado(args: {
  comunicado: Comunicado
  condominio: Condominio
  assinaturaUrl?: string | null
  emissorNome?: string | null
}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { comunicado, condominio, assinaturaUrl, emissorNome } = args

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  let y = 20

  if (condominio.logo_url) {
    try {
      const img = await carregarImagem(condominio.logo_url)
      const ratio = img.width / img.height
      const h = 22
      const w = h * ratio
      doc.addImage(img.dataUrl, img.format, 20, y - 5, w, h)
    } catch { /* ignora */ }
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
  doc.setDrawColor(29, 78, 216) // azul OnWay
  doc.setLineWidth(0.5)
  doc.line(20, y, W - 20, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('COMUNICADO OFICIAL', 105, y, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`${fmtData(comunicado.created_at)} · Nº ${comunicado.id.slice(0, 8).toUpperCase()}`, 105, y + 5, { align: 'center' })
  doc.setTextColor(20)
  y += 15

  // Titulo do comunicado
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  y = escreverBloco(doc, comunicado.titulo, 20, y, W - 40, 7)
  y += 6

  // Saudacao
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Prezados condôminos,', 20, y)
  y += 8

  // Corpo
  doc.setFontSize(10.5)
  const paragrafos = comunicado.corpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  for (const p of paragrafos) {
    y = escreverBloco(doc, p, 20, y, W - 40, 5.2)
    y += 4
    // Quebra de pagina se necessario
    if (y > H - 50) {
      doc.addPage()
      y = 20
    }
  }

  y = Math.max(y + 14, H - 55)
  if (assinaturaUrl) {
    try {
      const ass = await carregarImagem(assinaturaUrl)
      const maxW = 50, maxH = 18
      const ratio = ass.width / ass.height
      let w = maxW, h = maxW / ratio
      if (h > maxH) { h = maxH; w = maxH * ratio }
      doc.addImage(ass.dataUrl, ass.format, 105 - w / 2, y - h, w, h)
    } catch { /* ignora */ }
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

  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text(
    `Documento gerado eletronicamente · ${fmtData(new Date().toISOString())} · ID ${comunicado.id}`,
    105, H - 12, { align: 'center' },
  )

  const slug = (comunicado.titulo || 'comunicado').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const nome = `comunicado-${slug || 'sem-titulo'}-${comunicado.id.slice(0, 8)}.pdf`
  doc.save(nome)
}

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
