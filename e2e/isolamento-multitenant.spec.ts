import { test, expect } from '@playwright/test'
import {
  createTestUser, createTestServentia, linkMembro, cleanupServentia, cleanupUser, prisma,
} from './helpers/test-data'

const sufixo = `e2e-isolamento-${Date.now()}`

test.describe('Isolamento multi-tenant via HTTP (G9)', () => {
  test('Usuário da Serventia B não acessa evidência da Serventia A', async ({ page }) => {
    const password = 'Senha@Teste123'
    const userA = await createTestUser({ email: `iso-a-${sufixo}@example.com`, password })
    const userB = await createTestUser({ email: `iso-b-${sufixo}@example.com`, password })
    const serventiaA = await createTestServentia({ nome: `Iso A ${sufixo}`, cns: `ISOA-${sufixo}` })
    const serventiaB = await createTestServentia({ nome: `Iso B ${sufixo}`, cns: `ISOB-${sufixo}` })
    await linkMembro(userA.id, serventiaA.id, 'TITULAR')
    await linkMembro(userB.id, serventiaB.id, 'TITULAR')

    const requisito = await prisma.requisito.findFirstOrThrow()
    const progressoA = await prisma.progressoRequisito.create({
      data: { serventiaId: serventiaA.id, requisitoId: requisito.id, status: 'EM_ANDAMENTO' },
    })
    const evidenciaA = await prisma.evidencia.create({
      data: {
        progressoRequisitoId: progressoA.id,
        nomeArquivo: 'evidencia-de-a.pdf',
        storagePath: `${serventiaA.id}/${progressoA.id}/evidencia-de-a.pdf`,
        hashSha256: 'd'.repeat(64),
        tamanhoBytes: 100,
        uploadedBy: userA.id,
      },
    })

    try {
      // Autentica como usuário B (vinculado apenas à Serventia B)
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(userB.email)
      await page.getByLabel('Senha').fill(password)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/\/(dashboard|selecionar-serventia)/, { timeout: 15_000 })

      // Seleciona explicitamente a Serventia B como ativa antes das chamadas
      await page.request.post('/api/auth/select-serventia', { data: { serventiaId: serventiaB.id } })

      const download = await page.request.get(`/api/evidencias/${evidenciaA.id}/download`)
      expect(download.status()).toBe(403)

      const exclusao = await page.request.delete(`/api/evidencias/${evidenciaA.id}`)
      expect(exclusao.status()).toBe(403)

      const aindaExiste = await prisma.evidencia.findUnique({ where: { id: evidenciaA.id } })
      expect(aindaExiste?.deletedAt).toBeNull()
    } finally {
      await prisma.evidencia.deleteMany({ where: { id: evidenciaA.id } })
      await prisma.progressoRequisito.deleteMany({ where: { id: progressoA.id } })
      await cleanupServentia(serventiaA.id)
      await cleanupServentia(serventiaB.id)
      await cleanupUser(userA.id)
      await cleanupUser(userB.id)
    }
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
