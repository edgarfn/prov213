import { test, expect } from '@playwright/test'
import { createTestUser, createTestServentia, linkMembro, cleanupServentia, cleanupUser, prisma } from './helpers/test-data'

const sufixo = `e2e-seq-${Date.now()}`

test.describe('Sequencialidade de etapas (Anexo IV) — regressão do GAP 2', () => {
  test('Servidor bloqueia declarar Etapa 2 antes da Etapa 1, mesmo se o botão for forçado', async ({ page }) => {
    const email = `seq-${sufixo}@example.com`
    const password = 'Senha@Teste123'
    const user = await createTestUser({ email, password })
    const serventia = await createTestServentia({ nome: `Serventia Seq ${sufixo}`, cns: `SEQ-${sufixo}` })
    await linkMembro(user.id, serventia.id, 'TITULAR')

    try {
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(email)
      await page.getByLabel('Senha').fill(password)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/\/(dashboard|selecionar-serventia)/, { timeout: 15_000 })

      await page.goto('/checklists')
      await page.getByRole('tab', { name: /Etapa 2/ }).click()

      const botaoDeclarar = page.getByRole('button', { name: 'Declarar Conclusão' })
      await expect(botaoDeclarar).toBeDisabled()

      // Fonte única da regra (lib/business-rules.ts::podeDeclaraEtapa) só é
      // realmente comprovada se o SERVIDOR recusar mesmo burlando a UI —
      // por isso removemos o atributo disabled manualmente antes de clicar.
      await botaoDeclarar.evaluate((el) => el.removeAttribute('disabled'))
      await botaoDeclarar.click()

      await expect(page.getByText(/ainda não foi declarada concluída/)).toBeVisible({ timeout: 10_000 })

      const declaracao = await prisma.declaracao.findFirst({
        where: { serventiaId: serventia.id, etapa: { numero: 2 } },
      })
      expect(declaracao).toBeNull()
    } finally {
      await cleanupServentia(serventia.id)
      await cleanupUser(user.id)
    }
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
