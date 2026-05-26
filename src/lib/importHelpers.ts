// Utilitários compartilhados pra importação XLSX/CSV em massa.

export async function parseTabularFile(file: File): Promise<Record<string, string>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv' || file.type.includes('csv')) {
    return parseCsv(file)
  }
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, string>[]
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

/** Normaliza header pra busca em HEADER_MAP — lowercase + sem acento + underscores. */
export function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
}

/** Aplica HEADER_MAP nos campos de uma linha bruta. Valores devolvidos como string (trim). */
export function applyHeaderMap<T extends object>(
  raw: Record<string, string>,
  headerMap: Record<string, keyof T>,
): Partial<Record<keyof T, string>> {
  const r: Partial<Record<keyof T, string>> = {}
  for (const [key, val] of Object.entries(raw)) {
    const norm = normalizeHeader(key)
    const target = headerMap[norm] ?? headerMap[norm.replace(/_/g, ' ')]
    if (target) r[target] = String(val ?? '').trim()
  }
  return r
}

export function digitsOrNull(s: string | null | undefined): string | null {
  if (!s) return null
  const d = String(s).replace(/\D/g, '')
  return d.length ? d : null
}

export function numberOrNull(s: string | null | undefined): number | null {
  if (!s) return null
  const cleaned = String(s).replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

export async function gerarXlsxModelo(
  filename: string,
  sheetName: string,
  headers: string[],
  exemplos: (string | number)[][],
  larguras?: number[],
): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([headers, ...exemplos])
  if (larguras) {
    ws['!cols'] = larguras.map((wch) => ({ wch }))
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}
