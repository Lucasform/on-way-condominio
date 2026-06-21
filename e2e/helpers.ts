import { Page } from '@playwright/test'

export const env = {
  adminEmail:   process.env.E2E_ADMIN_EMAIL   ?? '',
  adminPass:    process.env.E2E_ADMIN_PASS    ?? '',
  sindicoEmail: process.env.E2E_SINDICO_EMAIL ?? '',
  sindicoPass:  process.env.E2E_SINDICO_PASS  ?? '',
}

/** Faz login via formulário e aguarda o redirect pós-autenticação. */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/entrar')
  await page.getByLabel(/e-mail/i).fill(email)
  await page.getByLabel(/senha/i).fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  // Aguarda sair da página /entrar (redirect para dashboard)
  await page.waitForURL((url) => !url.pathname.startsWith('/entrar'), { timeout: 10_000 })
}

/** Faz logout pelo botão de Sair na sidebar. */
export async function logout(page: Page) {
  await page.getByRole('button', { name: /sair/i }).click()
  await page.waitForURL('**/entrar')
}
