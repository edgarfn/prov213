import { defineConfig, devices } from '@playwright/test'

/**
 * Testes E2E dos fluxos críticos (Fase 6.2). Exigem:
 *  - Um banco de teste dedicado (DATABASE_URL != produção) já migrado
 *    (`npx prisma migrate deploy`) e semeado (`npm run db:seed`).
 *  - Chaves de teste do Cloudflare Turnstile em NEXT_PUBLIC_TURNSTILE_SITE_KEY /
 *    TURNSTILE_SECRET_KEY (as "test keys" documentadas para o ambiente local
 *    sempre aprovam a verificação, sem depender de rede externa).
 *
 * Rodar com `npm run test:e2e` (requer `npx playwright install` uma vez,
 * para baixar os binários dos navegadores).
 */
const PORT = process.env.PLAYWRIGHT_PORT ?? '3100'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PORT },
  },
})
