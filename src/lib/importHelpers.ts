// Utilitários compartilhados pra importação XLSX/CSV em massa.

// Extrai uma mensagem de erro amigavel a partir do erro do supabase.
// Tenta sempre incluir o nome do campo quando possivel pra o usuario
// leigo saber EXATAMENTE o que arrumar na planilha.
export function msgErroImport(e: unknown): string {
  if (!e) return 'erro desconhecido'
  if (typeof e === 'string') return traduzir(e, e)

  const obj = e as { code?: string; message?: string; details?: string; hint?: string }
  const code = obj.code
  // Combina tudo que o supabase devolve pra extrair o melhor contexto possivel
  const blob = [obj.message, obj.details, obj.hint].filter(Boolean).join(' | ')
  const campo = extrairCampo(blob)

  // Codigos PG mais comuns em insert
  if (code === '23505') return campo ? `Já existe um registro com esse ${campo}` : 'Já existe um registro com esses dados'
  if (code === '23502') return campo ? `Preencha o campo ${campo}` : 'Preencha todos os campos obrigatórios'
  if (code === '23503') return campo ? `O ${campo} informado não existe no sistema` : 'Algum dado vinculado não existe no sistema'
  if (code === '23514') return campo ? `Valor inválido em ${campo}` : 'Algum valor está fora do permitido'
  if (code === '42501' || code === 'PGRST301') return 'Sem permissão pra cadastrar (verifique seu perfil de acesso)'

  // Date parsing — Postgres usa 22007/22008
  if (code === '22007' || code === '22008' || /datestyle|invalid input syntax for type date/i.test(blob)) {
    return campo
      ? `Data inválida em ${campo}. Use AAAA-MM-DD (ex: 2026-05-27) ou DD/MM/AAAA`
      : 'Data com formato inválido. Use AAAA-MM-DD (ex: 2026-05-27) ou DD/MM/AAAA'
  }

  // Fallback: usa a mensagem disponivel traduzindo trechos conhecidos
  const raw = obj.message || obj.details || obj.hint
  if (!raw) {
    try { return JSON.stringify(e).slice(0, 120) } catch { return 'erro desconhecido' }
  }
  return traduzir(String(raw).replace(/\s+/g, ' ').trim(), blob).slice(0, 160)
}

// Mapa de coluna PG -> rotulo amigavel pro usuario.
// Quando a coluna nao estiver aqui, usa o proprio nome.
const ROTULO_CAMPO: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'e-mail',
  telefone: 'telefone',
  nome: 'nome',
  data_nascimento: 'data de nascimento',
  numero: 'número',
  bloco: 'bloco',
  placa: 'placa',
  unidade_id: 'unidade',
  condominio_id: 'condomínio',
  pessoa_id: 'pessoa',
  user_id: 'usuário',
}

function rotulo(col: string): string {
  return ROTULO_CAMPO[col] ?? col.replace(/_/g, ' ')
}

// Tenta encontrar o nome de uma coluna no blob de erro.
// Postgres devolve coisas como:
//   - 'null value in column "data_nascimento" violates...'
//   - 'duplicate key value violates unique constraint "pessoas_cpf_uidx"'
//   - 'new row for relation "pessoas" violates check constraint "..."'
//   - 'invalid input syntax for type date: "30/02/2026"'
function extrairCampo(blob: string): string | null {
  if (!blob) return null
  // Padrao mais limpo: column "X"
  const m1 = blob.match(/column "([a-z_][a-z0-9_]*)"/i)
  if (m1) return rotulo(m1[1])
  // Constraint que sugere coluna: pessoas_cpf_uidx, pessoas_email_unique, etc
  const m2 = blob.match(/constraint "[a-z]+_([a-z_]+)_(?:uidx|unique|key|fkey|check)"/i)
  if (m2) return rotulo(m2[1])
  // detail tipo: Key (cpf)=(123)... already=...
  const m3 = blob.match(/Key \(([a-z_,\s]+)\)/i)
  if (m3) return rotulo(m3[1].split(',')[0].trim())
  return null
}

// Traduz trechos em ingles do Postgres pro PT-BR amigavel.
function traduzir(raw: string, blob: string): string {
  const lower = raw.toLowerCase()
  const campo = extrairCampo(blob)
  if (lower.includes('datestyle') || lower.includes('invalid input syntax for type date')) {
    return campo
      ? `Data inválida em ${campo}. Use AAAA-MM-DD ou DD/MM/AAAA`
      : 'Data com formato inválido. Use AAAA-MM-DD ou DD/MM/AAAA'
  }
  if (lower.includes('invalid input syntax for type integer')) return campo ? `Número inteiro inválido em ${campo}` : 'Número inteiro com formato inválido'
  if (lower.includes('invalid input syntax for type numeric')) return campo ? `Valor numérico inválido em ${campo}` : 'Valor numérico com formato inválido'
  if (lower.includes('invalid input syntax for type uuid')) return campo ? `Identificador inválido em ${campo}` : 'Identificador com formato inválido'
  if (lower.includes('duplicate key value')) return campo ? `Já existe um registro com esse ${campo}` : 'Já existe um registro com esses dados'
  if (lower.includes('null value in column')) return campo ? `Preencha o campo ${campo}` : 'Preencha todos os campos obrigatórios'
  if (lower.includes('violates not-null constraint')) return campo ? `Preencha o campo ${campo}` : 'Preencha todos os campos obrigatórios'
  if (lower.includes('violates check constraint')) return campo ? `Valor inválido em ${campo}` : 'Algum valor está fora do permitido'
  if (lower.includes('violates foreign key constraint')) return campo ? `O ${campo} informado não existe no sistema` : 'Algum dado vinculado não existe no sistema'
  if (lower.includes('row-level security') || lower.includes('rls')) return 'Sem permissão pra cadastrar (verifique seu perfil de acesso)'
  if (lower.includes('value too long for type')) return campo ? `Texto longo demais em ${campo}` : 'Texto longo demais pra coluna'
  return raw
}

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
