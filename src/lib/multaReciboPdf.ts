// Recibo de quitacao de multa em PDF.
import type { Multa } from '../types/multa'
import type { Unidade } from '../types/unidade'
import type { Pessoa } from '../types/pessoa'
import type { Condominio } from '../types/condominio'

export async function gerarPdfRecibo(args: {
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
  let y = 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(16, 185, 129)
  doc.text('RECIBO DE QUITAÇÃO', 105, y, { align: 'center' })
  doc.setTextColor(20)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Multa nº ${multa.id.slice(0, 8).toUpperCase()}`, 105, y, { align: 'center' })
  y += 14

  doc.setDrawColor(16, 185, 129)
  doc.setLineWidth(0.6)
  doc.line(20, y, W - 20, y)
  y += 10

  // Condominio
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(condominio.nome, 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(
    [condominio.endereco, condominio.bairro, condominio.cidade && `${condominio.cidade}/${condominio.estado ?? ''}`]
      .filter(Boolean).join(' · '),
    20, y,
  )
  if (condominio.cnpj) { y += 5; doc.text(`CNPJ ${formatarCNPJ(condominio.cnpj)}`, 20, y) }
  doc.setTextColor(20)
  y += 12

  // Destinatario
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Quitante', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const unidadeLabel = unidade ? (unidade.bloco ? `${unidade.bloco}-${unidade.numero}` : unidade.numero) : '—'
  doc.text(`Nome: ${pessoa?.nome ?? '(à unidade)'}`, 20, y); y += 5
  doc.text(`Unidade: ${unidadeLabel}`, 20, y); y += 5
  if (pessoa?.cpf) { doc.text(`CPF: ${formatarCPF(pessoa.cpf)}`, 20, y); y += 5 }
  y += 6

  // Valor
  doc.setFillColor(220, 252, 231)
  doc.rect(20, y, W - 40, 24, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(6, 95, 70)
  doc.text('Valor quitado', 25, y + 8)
  doc.setFontSize(20)
  doc.text(`R$ ${Number(multa.valor).toFixed(2).replace('.', ',')}`, W - 25, y + 16, { align: 'right' })
  doc.setTextColor(20)
  doc.setFont('helvetica', 'normal')
  y += 30

  // Texto
  doc.setFontSize(10)
  const corpo = [
    `Declaramos que ${pessoa?.nome ?? 'o(a) responsável pela unidade'} (${unidadeLabel}) quitou integralmente a multa identificada acima, registrada em ${fmt(multa.created_at)}${multa.data_aplicacao ? ` e aplicada em ${fmt(multa.data_aplicacao)}` : ''}.`,
    multa.data_pagamento ? `Quitação registrada em ${fmt(multa.data_pagamento)}.` : '',
    'Para todos os fins, este recibo serve como comprovante de quitação da obrigação acima.',
  ].filter(Boolean)
  for (const p of corpo) {
    y = bloco(doc, p, 20, y, W - 40, 5)
    y += 4
  }

  // Descricao da infracao
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text('Descrição da infração original:', 20, y); y += 5
  doc.setTextColor(80)
  y = bloco(doc, multa.descricao, 20, y, W - 40, 5)
  doc.setTextColor(20)

  // Assinatura
  y = Math.max(y + 14, H - 55)
  if (assinaturaUrl) {
    try {
      const ass = await carregarImagem(assinaturaUrl)
      const maxW = 50, maxH = 18
      const ratio = ass.width / ass.height
      let w = maxW, h = maxW / ratio
      if (h > maxH) { h = maxH; w = maxH * ratio }
      doc.addImage(ass.dataUrl, ass.format, 105 - w / 2, y - h, w, h)
    } catch { /* noop */ }
  }
  doc.setDrawColor(150)
  doc.line(60, y, W - 60, y)
  doc.setFontSize(10)
  doc.text(emissorNome ?? 'Síndico', 105, y + 5, { align: 'center' })
  doc.text(condominio.nome, 105, y + 10, { align: 'center' })

  // Rodape
  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text(
    `Recibo eletrônico gerado pelo OnWay Condomínio · ${fmt(new Date().toISOString())} · ID ${multa.id}`,
    105, H - 12, { align: 'center' },
  )

  doc.save(`recibo-${unidadeLabel}-${multa.id.slice(0, 8)}.pdf`)
}

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
