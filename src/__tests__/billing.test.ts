import { describe, it, expect } from 'vitest'
import { resolverFeaturesDisponiveis } from '../lib/billing'
import { PLANO_CATALOG } from '../types/billing'
import type { Assinatura } from '../types/billing'
import type { FeatureKey } from '../types/featureFlag'

const ALL_FEATURES: FeatureKey[] = ['portaria', 'acessos', 'moradores', 'mural', 'ocorrencias', 'chat', 'multas']

const base: Assinatura = {
  id: 'test-id',
  condominio_id: 'condo-1',
  plano_id: 'basico',
  status: 'ativo',
  features_plano: ['portaria', 'acessos', 'moradores'],
  features_extras: [],
  limite_unidades: 30,
  limite_staff: 2,
  storage_gb: 1,
  trial_ends_at: null,
  periodo_inicio: null,
  periodo_fim: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('resolverFeaturesDisponiveis', () => {
  it('trial retorna todas as features globais', () => {
    const assinatura: Assinatura = { ...base, status: 'trial' }
    const features = resolverFeaturesDisponiveis(assinatura, ALL_FEATURES)
    expect(features).toEqual(new Set(ALL_FEATURES))
  })

  it('ativo retorna features_plano + features_extras', () => {
    const assinatura: Assinatura = {
      ...base,
      status: 'ativo',
      features_plano: ['portaria', 'acessos'],
      features_extras: ['chat'],
    }
    const features = resolverFeaturesDisponiveis(assinatura, ALL_FEATURES)
    expect(features).toEqual(new Set(['portaria', 'acessos', 'chat']))
  })

  it('inadimplente retorna Set vazio', () => {
    const assinatura: Assinatura = { ...base, status: 'inadimplente' }
    const features = resolverFeaturesDisponiveis(assinatura, ALL_FEATURES)
    expect(features.size).toBe(0)
  })

  it('cancelado retorna Set vazio', () => {
    const assinatura: Assinatura = { ...base, status: 'cancelado' }
    const features = resolverFeaturesDisponiveis(assinatura, ALL_FEATURES)
    expect(features.size).toBe(0)
  })

  it('assinatura null retorna todas as features (modo trial)', () => {
    const features = resolverFeaturesDisponiveis(null, ALL_FEATURES)
    expect(features).toEqual(new Set(ALL_FEATURES))
  })
})

describe('PLANO_CATALOG', () => {
  it('todos os planos têm id, nome e preco_mensal definidos ou null', () => {
    for (const plano of PLANO_CATALOG) {
      expect(plano.id).toBeTruthy()
      expect(plano.nome).toBeTruthy()
      expect(plano.preco_mensal === null || typeof plano.preco_mensal === 'number').toBe(true)
    }
  })

  it('enterprise contém todas as features dos planos menores', () => {
    const basico = PLANO_CATALOG.find(p => p.id === 'basico')
    const enterprise = PLANO_CATALOG.find(p => p.id === 'enterprise')
    if (!basico || !enterprise) throw new Error('Plano não encontrado no catálogo')
    for (const feature of basico.features) {
      expect(enterprise.features).toContain(feature)
    }
  })

  it('preços em ordem crescente (basico < profissional < enterprise)', () => {
    const prices = PLANO_CATALOG
      .filter(p => p.preco_mensal !== null)
      .map(p => p.preco_mensal as number)
      .slice(0, 3)
    expect(prices[0]).toBeLessThan(prices[1])
    expect(prices[1]).toBeLessThan(prices[2])
  })
})
