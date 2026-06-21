import { test, expect } from '@playwright/test'
import { loginAs, env } from './helpers'

test.describe('Portal do Morador', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!env.sindicoEmail, 'E2E_SINDICO_EMAIL não configurado')
    await loginAs(page, env.sindicoEmail, env.sindicoPass)
  })

  test('rota /moradores carrega sem erro de permissão', async ({ page }) => {
    await page.goto('/moradores')
    await expect(
      page.getByRole('table')
        .or(page.getByText(/nenhum morador|sem moradores/i))
        .or(page.getByRole('heading', { name: /morador/i }))
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/permissão negada|unauthorized|403/i)).not.toBeVisible()
  })

  test('rota /mural carrega', async ({ page }) => {
    await page.goto('/mural')
    await expect(
      page.getByRole('heading', { name: /mural|aviso/i })
        .or(page.getByText(/nenhum aviso/i))
    ).toBeVisible({ timeout: 10_000 })
  })
})
