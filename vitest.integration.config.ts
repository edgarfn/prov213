import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Config separada para testes de integração (tests/integration/**), que
 * exigem um banco Postgres real (DATABASE_URL) — normalmente um banco de
 * teste dedicado, nunca o de produção. Rodar com `npm run test:integration`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    // Integração cria/limpa dados reais no banco — evita corridas entre arquivos
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
