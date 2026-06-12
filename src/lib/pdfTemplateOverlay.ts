/**
 * Overlay de conteúdo sobre um modelo PDF de condomínio.
 *
 * Estratégia:
 *  1. Copia a página 1 do modelo como fundo (mantine header/footer de identidade visual).
 *  2. Cobre a área de conteúdo com branco, apagando placeholders do template.
 *  3. Desenha os campos do documento na zona segura (entre cabeçalho e rodapé).
 *
 * Retorna os bytes finais do PDF pronto para download.
 */

import type { PDFPage } from 'pdf-lib'

export interface OverlayField {
  label?: string
  value: string
  bold?: boolean
  size?: number
  color?: [number, number, number]
}

export interface OverlayBox {
  label: string
  value: string
  bg: [number, number, number]
  fg: [number, number, number]
}

export interface OverlayDocData {
  titulo: string
  numero: string
  data: string
  destinatario: { nome: string; unidade: string; cpf?: string }
  campos: OverlayField[]
  caixa?: OverlayBox
  corpo: string[]
  assinaturaUrl?: string | null
  emissorNome?: string
  condominioNome: string
  idDocumento: string
}

/** Carrega bytes de uma URL via fetch */
async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

/** Converte URL de imagem para Uint8Array + mime-type */
async function fetchImageInfo(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(url)
  const mime = res.headers.get('content-type') ?? 'image/jpeg'
  const buf = await res.arrayBuffer()
  return { bytes: new Uint8Array(buf), mime }
}

/**
 * Quebra texto em linhas com largura máxima (em pt), estimando ~6pt por caractere.
 * Retorna array de linhas.
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharPt = fontSize * 0.5
  const charsPerLine = Math.floor(maxWidth / avgCharPt)
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > charsPerLine) {
      if (line) lines.push(line)
      line = word
    } else {
      line = line ? line + ' ' + word : word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/**
 * Gera um PDF com o conteúdo sobreposto sobre o modelo de template do condomínio.
 * Se o templateUrl falhar, gera sem template (fundo branco limpo).
 */
export async function gerarPdfComTemplate(
  templateUrl: string | null | undefined,
  data: OverlayDocData,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const pdfDoc = await PDFDocument.create()
  let page: PDFPage

  if (templateUrl) {
    try {
      const templateBytes = await fetchBytes(templateUrl)
      const templateDoc = await PDFDocument.load(templateBytes)
      const [copied] = await pdfDoc.copyPages(templateDoc, [0])
      pdfDoc.addPage(copied)
      page = pdfDoc.getPages()[0]
    } catch {
      page = pdfDoc.addPage([595.28, 841.89])
    }
  } else {
    page = pdfDoc.addPage([595.28, 841.89])
  }

  const { width, height } = page.getSize()
  // Zona de conteúdo: deixa 110pt de cabeçalho + 80pt de rodapé
  const HEADER_H = 110
  const FOOTER_H = 80
  const contentTop = height - HEADER_H
  const contentBottom = FOOTER_H
  const marginX = 40
  const contentWidth = width - marginX * 2

  // Cobre área de conteúdo do template com branco
  if (templateUrl) {
    page.drawRectangle({
      x: marginX - 5,
      y: contentBottom,
      width: contentWidth + 10,
      height: contentTop - contentBottom,
      color: rgb(1, 1, 1),
      opacity: 0.97,
    })
  }

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = contentTop - 14

  // Se não tem template, desenha cabeçalho simples
  if (!templateUrl) {
    page.drawText(data.condominioNome, {
      x: marginX,
      y: y,
      font: bold,
      size: 14,
      color: rgb(0.07, 0.1, 0.2),
    })
    y -= 18
    page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.5, color: rgb(0.55, 0.08, 0.14) })
    y -= 12
  }

  // Título do documento
  const tituloW = bold.widthOfTextAtSize(data.titulo, 13)
  page.drawText(data.titulo, {
    x: width / 2 - tituloW / 2,
    y,
    font: bold,
    size: 13,
    color: rgb(0.07, 0.1, 0.2),
  })
  y -= 14

  const sub = `Nº ${data.numero.slice(0, 8).toUpperCase()} · ${data.data}`
  const subW = regular.widthOfTextAtSize(sub, 9)
  page.drawText(sub, {
    x: width / 2 - subW / 2,
    y,
    font: regular,
    size: 9,
    color: rgb(0.4, 0.4, 0.4),
  })
  y -= 16

  // Linha separadora
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) })
  y -= 12

  // Destinatário
  page.drawText('Destinatário', { x: marginX, y, font: bold, size: 10, color: rgb(0.2, 0.2, 0.2) })
  y -= 12
  page.drawText(`Nome: ${data.destinatario.nome}`, { x: marginX, y, font: regular, size: 9.5, color: rgb(0.1, 0.1, 0.1) })
  y -= 11
  page.drawText(`Unidade: ${data.destinatario.unidade}`, { x: marginX, y, font: regular, size: 9.5, color: rgb(0.1, 0.1, 0.1) })
  y -= 11
  if (data.destinatario.cpf) {
    page.drawText(`CPF: ${data.destinatario.cpf}`, { x: marginX, y, font: regular, size: 9.5, color: rgb(0.1, 0.1, 0.1) })
    y -= 11
  }
  y -= 8

  // Campos customizados
  for (const campo of data.campos) {
    if (campo.label) {
      page.drawText(campo.label, { x: marginX, y, font: bold, size: 10, color: rgb(0.2, 0.2, 0.2) })
      y -= 12
    }
    const lines = wrapText(campo.value, contentWidth, 9.5)
    for (const line of lines) {
      if (y < contentBottom + 80) break
      const [r, g, b] = campo.color ?? [0.1, 0.1, 0.1]
      page.drawText(line, { x: marginX, y, font: campo.bold ? bold : regular, size: campo.size ?? 9.5, color: rgb(r, g, b) })
      y -= 11
    }
    y -= 5
  }

  // Caixa de destaque (valor ou aviso)
  if (data.caixa && y > contentBottom + 80) {
    const boxH = 32
    page.drawRectangle({
      x: marginX,
      y: y - boxH,
      width: contentWidth,
      height: boxH,
      color: rgb(...data.caixa.bg.map((c) => c / 255) as [number, number, number]),
      opacity: 1,
    })
    const [lr, lg, lb] = data.caixa.fg.map((c) => c / 255) as [number, number, number]
    page.drawText(data.caixa.label, { x: marginX + 8, y: y - 12, font: bold, size: 10, color: rgb(lr, lg, lb) })
    const valW = bold.widthOfTextAtSize(data.caixa.value, 13)
    page.drawText(data.caixa.value, { x: width - marginX - valW - 8, y: y - 18, font: bold, size: 13, color: rgb(lr, lg, lb) })
    y -= boxH + 10
  }

  // Corpo de texto
  for (const paragrafo of data.corpo) {
    const lines = wrapText(paragrafo, contentWidth, 9)
    for (const line of lines) {
      if (y < contentBottom + 60) break
      page.drawText(line, { x: marginX, y, font: regular, size: 9, color: rgb(0.15, 0.15, 0.15) })
      y -= 10.5
    }
    y -= 5
  }

  // Assinatura
  const sigY = Math.min(y - 20, contentBottom + 55)
  if (data.assinaturaUrl) {
    try {
      const { bytes: imgBytes, mime } = await fetchImageInfo(data.assinaturaUrl)
      const embImg = mime.includes('png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
      const maxW = 80, maxH = 24
      const scale = Math.min(maxW / embImg.width, maxH / embImg.height)
      const w = embImg.width * scale
      const h = embImg.height * scale
      page.drawImage(embImg, { x: width / 2 - w / 2, y: sigY, width: w, height: h })
    } catch { /* ignora */ }
  }

  page.drawLine({ start: { x: width / 2 - 70, y: sigY }, end: { x: width / 2 + 70, y: sigY }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) })
  const emissor = data.emissorNome ?? 'Síndico'
  const emissorW = regular.widthOfTextAtSize(emissor, 9)
  page.drawText(emissor, { x: width / 2 - emissorW / 2, y: sigY - 10, font: regular, size: 9, color: rgb(0.3, 0.3, 0.3) })
  const cnomeW = regular.widthOfTextAtSize(data.condominioNome, 8)
  page.drawText(data.condominioNome, { x: width / 2 - cnomeW / 2, y: sigY - 19, font: regular, size: 8, color: rgb(0.4, 0.4, 0.4) })

  // Rodapé (apenas sem template)
  if (!templateUrl) {
    const footer = `Documento gerado eletronicamente pelo OnWay Condomínio · ID ${data.idDocumento}`
    const footerW = regular.widthOfTextAtSize(footer, 7)
    page.drawText(footer, { x: width / 2 - footerW / 2, y: 20, font: regular, size: 7, color: rgb(0.55, 0.55, 0.55) })
  }

  return pdfDoc.save()
}

/** Trigger de download do PDF nos bytes gerados */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
