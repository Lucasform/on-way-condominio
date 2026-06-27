import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../lib/retry'

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
