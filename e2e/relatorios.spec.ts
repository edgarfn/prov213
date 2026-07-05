import { test, expect } from '@playwright/test'
import {
  createTestUser, createTestServentia, linkMembro, cleanupServentia, cleanupUser, prisma,
} from './helpers/test-data'

const sufixo = `e2e-relatorios-${Date.now()}`

test.describe('Geração de relatórios e pacote probatório (Fase 2)', () => {
  test('Cada endpoint de relatório responde 200 com o content-type correto', async ({ page }) => {
    const email = `relatorios-${sufixo}@example.com`
    const password = 'Senha@Teste123'
    const user = await createTestUser({ email, password })
    const serventia = await createTestServentia({
      nome: `Serventia Relatórios ${sufixo}`,
      cns: `REL-${sufixo}`,
      classe: 'CLASSE_1',
    })
    await linkMembro(user.id, serventia.id, 'TITULAR')

    const etapa = await prisma.etapa.findFirstOrThrow({ orderBy: { numero: 'asc' } })
    const requisito = await prisma.requisito.findFirstOrThrow({ where: { etapaId: etapa.id } })
    const progresso = await prisma.progressoRequisito.create({
      data: { serventiaId: serventia.id, requisitoId: requisito.id, status: 'CONCLUIDO' },
    })
    const evidencia = await prisma.evidencia.create({
      data: {
        progressoRequisitoId: progresso.id,
        nomeArquivo: 'evidencia-relatorio.pdf',
        storagePath: `${serventia.id}/${progresso.id}/evidencia-relatorio.pdf`,
        hashSha256: 'c'.repeat(64),
        tamanhoBytes: 100,
        uploadedBy: user.id,
      },
    })

    try {
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(email)
      await page.getByLabel('Senha').fill(password)
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 15_000 })
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page).toHaveURL(/\/(dashboard|selecionar-serventia)/, { timeout: 15_000 })

      const statusResp = await page.request.get('/api/relatorios/status-conformidade')
      expect(statusResp.status()).toBe(200)
      expect(statusResp.headers()['content-type']).toContain('application/pdf')

      const simplificadoResp = await page.request.get(`/api/relatorios/simplificado?etapaId=${etapa.id}`)
      expect(simplificadoResp.status()).toBe(200)
      expect(simplificadoResp.headers()['content-type']).toContain('application/pdf')

      const pacoteResp = await page.request.get('/api/relatorios/pacote-probatorio')
      expect(pacoteResp.status()).toBe(200)
      expect(pacoteResp.headers()['content-type']).toContain('application/zip')
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
