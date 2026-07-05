import { defineConfig, configDefaults } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Testes de integração (tests/integration/**) exigem um banco de dados real
    // (DATABASE_URL) e rodam separadamente via `npm run test:integration`; os
    // specs do Playwright (e2e/**) usam seu próprio test runner — nenhum dos
    // dois faz parte da suíte padrão, para que `npm test` não dependa de infra externa.
    exclude: [...configDefaults.exclude, 'tests/integration/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
