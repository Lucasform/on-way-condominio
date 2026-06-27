import { describe, it, expect } from 'vitest'
import { PLANO_CATALOG } from '../types/billing'
import type { PlanoId } from '../types/billing'

const ALL_PLANO_IDS: PlanoId[] = ['basico', 'profissional', 'enterprise', 'custom']

function findPlano(id: PlanoId) {
  const p = PLANO_CATALOG.find(p => p.id === id)
  if (!p) throw new Error(`Plano "${id}" não encontrado no catálogo`)
  return p
}

describe('PLANO_CATALOG structure', () => {
  it('contains exactly 4 planos', () => {
    expect(PLANO_CATALOG).toHaveLength(4)
  })

  it('contains all expected plano ids', () => {
    const ids = PLANO_CATALOG.map(p => p.id)
    for (const expected of ALL_PLANO_IDS) {
      expect(ids).toContain(expected)
    }
  })

  it('basico has a non-empty features array', () => {
    expect(findPlano('basico').features.length).toBeGreaterThan(0)
  })

  it('profissional has a non-empty features array', () => {
    expect(findPlano('profissional').features.length).toBeGreaterThan(0)
  })

  it('enterprise has a non-empty features array', () => {
    expect(findPlano('enterprise').features.length).toBeGreaterThan(0)
  })

  it('custom has an empty features array (configured per client)', () => {
    expect(findPlano('custom').features).toHaveLength(0)
  })

  it('enterprise has more features than profissional', () => {
    expect(findPlano('enterprise').features.length).toBeGreaterThan(
      findPlano('profissional').features.length
    )
  })

  it('profissional has more features than basico', () => {
    expect(findPlano('profissional').features.length).toBeGreaterThan(
      findPlano('basico').features.length
    )
  })

  it('custom has null preco_mensal (sob consulta)', () => {
    expect(findPlano('custom').preco_mensal).toBeNull()
  })

  it('all non-custom planos have positive preco_mensal', () => {
    const nonCustom = PLANO_CATALOG.filter(p => p.id !== 'custom')
    for (const plano of nonCustom) {
      expect(plano.preco_mensal).toBeGreaterThan(0)
    }
  })

  it('each plano has a nome and descricao', () => {
    for (const plano of PLANO_CATALOG) {
      expect(plano.nome).toBeTruthy()
      expect(plano.descricao).toBeTruthy()
    }
  })
})
