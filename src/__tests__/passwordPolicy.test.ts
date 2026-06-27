import { describe, it, expect } from 'vitest'
import { validatePassword, PASSWORD_MIN_LENGTH, PASSWORD_HINT } from '../lib/passwordPolicy'

describe('PASSWORD_MIN_LENGTH', () => {
  it('is 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})

describe('PASSWORD_HINT', () => {
  it('is a non-empty string mentioning minimum length', () => {
    expect(typeof PASSWORD_HINT).toBe('string')
    expect(PASSWORD_HINT.length).toBeGreaterThan(0)
    expect(PASSWORD_HINT).toContain('8')
  })
})

describe('validatePassword', () => {
  it('returns ok=true for a valid password', () => {
    const result = validatePassword('Senha123')
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns ok=false when password is too short', () => {
    const result = validatePassword('Ab1')
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('8'))).toBe(true)
  })

  it('returns error when no lowercase letter is present', () => {
    const result = validatePassword('SENHA1234')
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => /min[uú]scula/i.test(e))).toBe(true)
  })

  it('returns error when no uppercase letter is present', () => {
    const result = validatePassword('senha1234')
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => /mai[uú]scula/i.test(e))).toBe(true)
  })

  it('returns error when no digit is present', () => {
    const result = validatePassword('SenhaForte')
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => /n[uú]mero/i.test(e))).toBe(true)
  })

  it('accumulates multiple errors for an empty string', () => {
    const result = validatePassword('')
    expect(result.ok).toBe(false)
    // Expects: min length + lowercase + uppercase + digit = 4 errors
    expect(result.errors.length).toBeGreaterThanOrEqual(4)
  })

  it('returns ok=true for a longer valid password', () => {
    const result = validatePassword('SuperSecure2026!')
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns exactly the right number of errors when only one rule fails', () => {
    // Only missing a digit
    const result = validatePassword('SenhaForte')
    expect(result.errors).toHaveLength(1)
  })

  it('password of exactly 8 chars passes length check', () => {
    const result = validatePassword('Senha12!')
    // Only checking length is OK (other rules may or may not pass)
    const hasLengthError = result.errors.some(e => e.includes('8'))
    expect(hasLengthError).toBe(false)
  })

  it('password of 7 chars fails length check', () => {
    const result = validatePassword('Senha1!')
    const hasLengthError = result.errors.some(e => e.includes('8'))
    expect(hasLengthError).toBe(true)
  })
})
