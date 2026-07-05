import { test, expect } from '@playwright/test'
import { createTestUser, createTestServentia, linkMembro, cleanupServentia, cleanupUser, generateTotpCode, prisma } from './helpers/test-data'

const sufixo = `e2e-auth-${Date.now()}`

test.describe('Autenticação e MFA', () => {
  test('Login sem MFA leva ao dashboard', async ({ page }) => {
    const email = `sem-mfa-${sufixo}@example.com`
    const password = 'Senha@Teste123'
    const user = await createTestUser({ email, password, mfaEnabled: false })
    const serventia = await createTestServentia({ nome: `Serventia Login ${sufixo}`, cns: `LOGIN-${sufixo}` })
    await linkMembro(user.id, serventia.id, 'TITULAR')

    try {
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(email)
      await page.getByLabel('Senha').fill(password)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/\/(dashboard|selecionar-serventia)/, { timeout: 15_000 })
    } finally {
      await cleanupServentia(serventia.id)
      await cleanupUser(user.id)
    }
  })

  test('Login com MFA exige código de 6 dígitos válido', async ({ page }) => {
    const email = `com-mfa-${sufixo}@example.com`
    const password = 'Senha@Teste123'
    const user = await createTestUser({ email, password, mfaEnabled: true })
    const serventia = await createTestServentia({ nome: `Serventia MFA ${sufixo}`, cns: `MFA-${sufixo}` })
    await linkMembro(user.id, serventia.id, 'TITULAR')

    try {
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(email)
      await page.getByLabel('Senha').fill(password)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Entrar' }).click()

      await expect(page.getByText('Verificação em duas etapas')).toBeVisible({ timeout: 10_000 })

      const codigo = generateTotpCode(user.mfaSecret!)
      await page.getByLabel('Código de 6 dígitos').fill(codigo)
      await page.getByRole('button', { name: 'Verificar' }).click()

      await expect(page).toHaveURL(/\/(dashboard|selecionar-serventia)/, { timeout: 15_000 })
    } finally {
      await cleanupServentia(serventia.id)
      await cleanupUser(user.id)
    }
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
