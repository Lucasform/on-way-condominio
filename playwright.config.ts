import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração dos testes E2E.
 *
 * Variáveis de ambiente necessárias (copie para .env.test.local):
 *   E2E_BASE_URL      = http://localhost:5173  (local) ou https://onway-condominio.vercel.app (prod)
 *   E2E_ADMIN_EMAIL   = email do admin_onway de teste
 *   E2E_ADMIN_PASS    = senha do admin_onway de teste
 *   E2E_SINDICO_EMAIL = email do síndico de teste
 *   E2E_SINDICO_PASS  = senha do síndico de teste
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Sobe o servidor de dev automaticamente quando E2E_BASE_URL não estiver setado
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
