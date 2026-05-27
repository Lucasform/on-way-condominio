// Substituicao simples de variaveis em textos de template.
// Suporta {{nome}}, {{unidade}}, {{data}}, {{hora}}, {{condominio}}, {{cargo}}.
//
// Uso:
//   applyTemplateVars(template.corpo, { nome: 'Alice', unidade: 'A-101' })
//
// Variaveis nao informadas ficam como string vazia.

export interface TemplateVarsValues {
  nome?: string | null
  unidade?: string | null
  data?: string | null
  hora?: string | null
  condominio?: string | null
  cargo?: string | null
}

const SUPPORTED = ['nome', 'unidade', 'data', 'hora', 'condominio', 'cargo'] as const

export function applyTemplateVars(input: string, vars: TemplateVarsValues = {}): string {
  if (!input) return input
  const today = new Date()
  const defaults: Required<Record<typeof SUPPORTED[number], string>> = {
    nome: vars.nome ?? '',
    unidade: vars.unidade ?? '',
    data: vars.data ?? today.toLocaleDateString('pt-BR'),
    hora: vars.hora ?? today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    condominio: vars.condominio ?? '',
    cargo: vars.cargo ?? '',
  }
  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const k = key.toLowerCase().trim() as typeof SUPPORTED[number]
    if ((SUPPORTED as readonly string[]).includes(k)) return defaults[k]
    // mantem variaveis desconhecidas pra evitar perda silenciosa
    return full
  })
}

export const TEMPLATE_VARS_HINT =
  'Variáveis: {{nome}}, {{unidade}}, {{data}}, {{hora}}, {{condominio}}, {{cargo}}'

export function listTemplateVars(): readonly string[] {
  return SUPPORTED
}
