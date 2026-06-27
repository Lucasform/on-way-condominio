export type FeatureKey =
  | 'portaria'
  | 'acessos'
  | 'moradores'
  | 'pets'
  | 'veiculos'
  | 'mural'
  | 'ocorrencias'
  | 'chat'
  | 'comunicados'
  | 'classificados'
  | 'multas'
  | 'chamados'
  | 'calendario'
  | 'assembleias'
  | 'servicos'
  | 'regimento'
  | 'relatorios'
  | 'whatsapp'
  | 'reservas'
  | 'solicitacoes'

export interface FeatureFlag {
  key: FeatureKey
  nome: string
  descricao: string | null
  ativo: boolean
  updated_at: string
}

/** Mapa de rota → feature que a controla. Rotas ausentes são sempre visíveis. */
export const ROUTE_FEATURE: Partial<Record<string, FeatureKey>> = {
  '/encomendas':    'portaria',
  '/plantao':       'portaria',
  '/acessos':       'acessos',
  '/unidades':      'moradores',
  '/pessoas':       'moradores',
  '/veiculos':      'veiculos',
  '/pets':          'pets',
  '/mural':         'mural',
  '/ocorrencias':   'ocorrencias',
  '/chat':          'chat',
  '/comunicados':   'comunicados',
  '/classificados': 'classificados',
  '/multas':        'multas',
  '/chamados':      'chamados',
  '/calendario':    'calendario',
  '/assembleias':   'assembleias',
  '/votacoes':      'assembleias',
  '/servicos':      'servicos',
  '/regimento':     'regimento',
  '/relatorios':    'relatorios',
  '/whatsapp':      'whatsapp',
  '/reservas':      'reservas',
  '/solicitacoes':  'solicitacoes',
}
