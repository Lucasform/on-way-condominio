import { test, expect } from '@playwright/test'
import { loginAs, logout, env } from './helpers'

test.describe('Autenticação', () => {
  test('redireciona /entrar quando não autenticado', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('login com credenciais inválidas mostra erro', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByLabel(/e-mail/i).fill('invalido@teste.com')
    await page.getByLabel(/senha/i).fill('senhaerrada123')
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByText(/inválid|credencial|incorret/i)).toBeVisible({ timeout: 8_000 })
  })

  test('login como síndico e logout', async ({ page }) => {
    test.skip(!env.sindicoEmail, 'E2E_SINDICO_EMAIL não configurado')

    await loginAs(page, env.sindicoEmail, env.sindicoPass)
    // Verifica que está no dashboard (sidebar visível)
    await expect(page.getByRole('navigation')).toBeVisible()
    await logout(page)
    await expect(page).toHaveURL(/\/entrar/)
  })
})
