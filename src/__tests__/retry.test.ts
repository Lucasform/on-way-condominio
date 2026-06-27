import { describe, it, expect, vi } from 'vitest'
import { withRetry, isNetworkError, withCircuitBreaker } from '../lib/retry'

describe('withRetry', () => {
  it('retorna o resultado na primeira tentativa quando bem-sucedido', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('tenta novamente após falha e retorna na segunda', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 0 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('lança erro após esgotar todas as tentativas', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('sempre falha'))
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 0 })).rejects.toThrow('sempre falha')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('não tenta de novo quando shouldRetry retorna false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'))
    await expect(
      withRetry(fn, { attempts: 3, baseDelayMs: 0, shouldRetry: () => false })
    ).rejects.toThrow('fatal')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('isNetworkError', () => {
  it('identifica erro de fetch como erro de rede', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
  })

  it('identifica erro de timeout como erro de rede', () => {
    expect(isNetworkError(new Error('Request timeout'))).toBe(true)
  })

  it('não classifica erro de negócio como erro de rede', () => {
    expect(isNetworkError(new Error('Usuário não encontrado'))).toBe(false)
  })

  it('retorna false para valores não-Error', () => {
    expect(isNetworkError('string error')).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })
})

describe('withCircuitBreaker', () => {
  it('executa normalmente quando não há falhas', async () => {
    const fn = vi.fn().mockResolvedValue('resultado')
    const result = await withCircuitBreaker('test-ok', fn)
    expect(result).toBe('resultado')
  })

  it('abre o circuito após atingir o threshold de falhas', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('serviço fora'))
    const key = 'test-circuit-' + Math.random()

    for (let i = 0; i < 5; i++) {
      await expect(
        withCircuitBreaker(key, fn, { threshold: 5, cooldownMs: 60_000 })
      ).rejects.toThrow()
    }

    await expect(
      withCircuitBreaker(key, fn, { threshold: 5, cooldownMs: 60_000 })
    ).rejects.toThrow('CircuitBreaker')
  })
})
