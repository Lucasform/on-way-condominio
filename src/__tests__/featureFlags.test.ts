import { describe, it, expect } from 'vitest'
import { ROUTE_FEATURE } from '../types/featureFlag'
import type { FeatureKey } from '../types/featureFlag'

const VALID_KEYS: FeatureKey[] = [
  'portaria', 'acessos', 'moradores', 'pets', 'veiculos', 'mural',
  'ocorrencias', 'chat', 'comunicados', 'classificados', 'multas',
  'chamados', 'calendario', 'assembleias', 'servicos', 'regimento',
  'relatorios', 'whatsapp', 'reservas', 'solicitacoes',
]

describe('ROUTE_FEATURE', () => {
  it('todas as rotas mapeiam para uma FeatureKey válida', () => {
    for (const [route, key] of Object.entries(ROUTE_FEATURE)) {
      expect(VALID_KEYS, `Rota ${route} mapeia para feature inválida: ${key}`).toContain(key)
    }
  })

  it('rotas são strings que começam com /', () => {
    for (const route of Object.keys(ROUTE_FEATURE)) {
      expect(route.startsWith('/')).toBe(true)
    }
  })

  it('/ocorrencias mapeia para ocorrencias', () => {
    expect(ROUTE_FEATURE['/ocorrencias']).toBe('ocorrencias')
  })

  it('/multas mapeia para multas', () => {
    expect(ROUTE_FEATURE['/multas']).toBe('multas')
  })
})
