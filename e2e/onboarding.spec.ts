import { test, expect } from '@playwright/test'
import { createTestUser, cleanupServentia, cleanupUser, prisma } from './helpers/test-data'

const sufixo = `e2e-onboarding-${Date.now()}`

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test.describe('Onboarding — calculadora de classe personaliza os checklists', () => {
  test('Wizard calcula a classe pela arrecadação e cria a serventia', async ({ page }) => {
    const email = `onboarding-${sufixo}@example.com`
    const password = 'Senha@Teste123'
    const user = await createTestUser({ email, password, mfaEnabled: false })
    let serventiaId: string | undefined

    try {
      await login(page, email, password)

      await page.goto('/onboarding')
      await expect(page.getByRole('heading', { name: 'Identificação' })).toBeVisible({ timeout: 10_000 })

      // Etapa 1 — Identificação
      await page.getByLabel('Nome da Serventia *').fill(`Serventia E2E ${sufixo}`)
      await page.getByLabel(/CNS/).fill(`ONB-${sufixo}`)
      await page.getByLabel('Município *').fill('São Paulo')
      await page.getByLabel('UF *').click()
      await page.getByRole('option', { name: 'SP' }).click()
      await page.getByRole('button', { name: 'Próximo' }).click()

      // Etapa 2 — Classificação: usar a calculadora (R$ 300.000 → Classe 2)
      await expect(page.getByRole('heading', { name: 'Classificação' })).toBeVisible()
      await page.getByPlaceholder('Arrecadação semestral (R$)').fill('300000')
      await page.getByRole('button', { name: 'Calcular' }).click()
      await expect(page.getByText(/Classe sugerida/)).toContainText('Classe 2')

      await page.getByLabel('Tipo de Solução de TIC *').click()
      await page.getByRole('option', { name: /Própria/ }).click()
      await page.getByLabel('Infraestrutura *').click()
      await page.getByRole('option', { name: /Nuvem/ }).click()
      await page.getByRole('button', { name: 'Próximo' }).click()

      // Etapa 3 — Responsáveis (opcional, pula direto)
      await expect(page.getByRole('heading', { name: 'Responsáveis' })).toBeVisible()
      await page.getByRole('button', { name: 'Próximo' }).click()

      // Etapa 4 — Revisão e confirmação
      await expect(page.getByRole('heading', { name: 'Revisão' })).toBeVisible()
      await page.getByRole('button', { name: 'Criar meu plano de conformidade' }).click()

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })

      const serventia = await prisma.serventia.findUnique({ where: { cns: `ONB-${sufixo}` } })
      expect(serventia).not.toBeNull()
      expect(serventia?.classe).toBe('CLASSE_2')
      serventiaId = serventia?.id
    } finally {
      if (serventiaId) await cleanupServentia(serventiaId)
      await cleanupUser(user.id)
    }
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
