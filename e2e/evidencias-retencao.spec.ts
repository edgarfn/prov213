import { test, expect } from '@playwright/test'
import {
  createTestUser, createTestServentia, linkMembro, cleanupServentia, cleanupUser, prisma,
} from './helpers/test-data'

const sufixo = `e2e-retencao-${Date.now()}`

test.describe('Retenção obrigatória de evidências (Art. 7º, IV) — regressão do GAP 7', () => {
  test('Exclusão de evidência recém-criada é bloqueada pelo servidor', async ({ page }) => {
    const email = `retencao-${sufixo}@example.com`
    const password = 'Senha@Teste123'
    const user = await createTestUser({ email, password })
    const serventia = await createTestServentia({ nome: `Serventia Retenção ${sufixo}`, cns: `RET-${sufixo}` })
    await linkMembro(user.id, serventia.id, 'TITULAR')

    const requisito = await prisma.requisito.findFirstOrThrow()
    const progresso = await prisma.progressoRequisito.create({
      data: { serventiaId: serventia.id, requisitoId: requisito.id, status: 'EM_ANDAMENTO' },
    })
    const evidencia = await prisma.evidencia.create({
      data: {
        progressoRequisitoId: progresso.id,
        nomeArquivo: 'evidencia-recente.pdf',
        storagePath: `${serventia.id}/${progresso.id}/evidencia-recente.pdf`,
        hashSha256: 'b'.repeat(64),
        tamanhoBytes: 100,
        uploadedBy: user.id,
        uploadedAt: new Date(), // acabou de ser enviada — bem dentro dos 5 anos de retenção
      },
    })

    try {
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(email)
      await page.getByLabel('Senha').fill(password)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/\/(dashboard|selecionar-serventia)/, { timeout: 15_000 })

      // Prova a garantia no nível de servidor (o mesmo endpoint usado pela UI),
      // independentemente de o botão de exclusão estar visualmente bloqueado.
      const resposta = await page.request.delete(`/api/evidencias/${evidencia.id}`)
      expect(resposta.status()).toBe(403)
      const body = await resposta.json()
      expect(body.error).toMatch(/retenção obrigatória/i)

      const aindaExiste = await prisma.evidencia.findUnique({ where: { id: evidencia.id } })
      expect(aindaExiste?.deletedAt).toBeNull()
    } finally {
      await prisma.evidencia.deleteMany({ where: { id: evidencia.id } })
      await prisma.progressoRequisito.deleteMany({ where: { id: progresso.id } })
      await cleanupServentia(serventia.id)
      await cleanupUser(user.id)
    }
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
