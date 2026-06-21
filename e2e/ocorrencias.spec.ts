import { test, expect } from '@playwright/test'
import { loginAs, env } from './helpers'

test.describe('Ocorrências', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!env.sindicoEmail, 'E2E_SINDICO_EMAIL não configurado')
    await loginAs(page, env.sindicoEmail, env.sindicoPass)
  })

  test('lista de ocorrências carrega sem erro', async ({ page }) => {
    await page.goto('/ocorrencias')
    // Aguarda a lista ou estado vazio — não um spinner
    await expect(
      page.getByRole('table').or(page.getByText(/nenhuma|sem ocorrência/i))
    ).toBeVisible({ timeout: 10_000 })
    // Nenhuma mensagem de erro visível
    await expect(page.getByText(/erro|falha|não foi possível/i)).not.toBeVisible()
  })

  test('abre formulário de nova ocorrência', async ({ page }) => {
    await page.goto('/ocorrencias')
    const btnNova = page.getByRole('button', { name: /nova|registrar|adicionar/i })
    await expect(btnNova).toBeVisible({ timeout: 8_000 })
    await btnNova.click()
    // Modal ou página de criação deve aparecer
    await expect(
      page.getByRole('dialog').or(page.getByRole('heading', { name: /nova ocorrência/i }))
    ).toBeVisible({ timeout: 6_000 })
  })

  test('cria ocorrência e confirma na lista', async ({ page }) => {
    await page.goto('/ocorrencias')
    const btnNova = page.getByRole('button', { name: /nova|registrar|adicionar/i })
    await btnNova.click()

    const titulo = `Teste E2E ${Date.now()}`
    const tituloField = page.getByLabel(/título|assunto|descrição/i).first()
    await tituloField.fill(titulo)

    // Preenche demais campos obrigatórios que aparecerem
    const tipoField = page.getByLabel(/tipo|categoria/i).first()
    if (await tipoField.isVisible()) {
      await tipoField.selectOption({ index: 1 })
    }

    await page.getByRole('button', { name: /salvar|registrar|confirmar/i }).click()

    // Confirma que saiu do modal e o item aparece na lista
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(titulo)).toBeVisible({ timeout: 8_000 })
  })
})
