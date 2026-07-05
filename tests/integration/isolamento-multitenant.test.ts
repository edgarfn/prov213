/**
 * Testes de integração de isolamento multi-tenant (G9). Exigem um banco
 * Postgres real via DATABASE_URL — rode com `npm run test:integration`
 * contra um banco de TESTE dedicado (nunca o de produção), após
 * `npx prisma migrate deploy` e `npm run db:seed` (precisa do catálogo de
 * Etapas/Requisitos já semeado).
 *
 * Cobrem a garantia central do sistema (spec seção 6 / CLAUDE.md critério de
 * aceite): "Toda evidência anexada... é isolada por serventia (RLS
 * comprovada por teste)". Como o projeto usa Prisma + Postgres direto (sem
 * RLS nativo), o isolamento depende inteiramente da disciplina de cada
 * query filtrar por serventiaId — este arquivo prova isso na prática para os
 * pontos mais sensíveis (membership, evidências, incidentes, progresso).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../../lib/db'
import { requireServentiaMembro } from '../../lib/serventia-context'

describe('Isolamento multi-tenant', () => {
  let serventiaA: { id: string }
  let serventiaB: { id: string }
  let userA: { id: string }
  let userB: { id: string }
  let requisito: { id: string }
  let progressoA: { id: string }
  let evidenciaA: { id: string }
  let incidenteA: { id: string }

  const sufixo = `test-${Date.now()}`

  beforeAll(async () => {
    const requisitoExistente = await db.requisito.findFirst()
    if (!requisitoExistente) {
      throw new Error(
        'Nenhum requisito encontrado no catálogo — rode `npm run db:seed` no banco de teste antes deste teste.',
      )
    }
    requisito = requisitoExistente

    serventiaA = await db.serventia.create({
      data: {
        nome: `Serventia A ${sufixo}`,
        cns: `A-${sufixo}`,
        municipio: 'Município A',
        uf: 'SP',
        classe: 'CLASSE_1',
        tipoSolucao: 'PROPRIA',
        infra: 'NUVEM',
        dataVigenciaNorma: new Date('2026-02-20'),
        onboardingConcluido: true,
      },
    })
    serventiaB = await db.serventia.create({
      data: {
        nome: `Serventia B ${sufixo}`,
        cns: `B-${sufixo}`,
        municipio: 'Município B',
        uf: 'RJ',
        classe: 'CLASSE_1',
        tipoSolucao: 'PROPRIA',
        infra: 'NUVEM',
        dataVigenciaNorma: new Date('2026-02-20'),
        onboardingConcluido: true,
      },
    })

    userA = await db.user.create({ data: { email: `user-a-${sufixo}@example.com`, name: 'Usuário A' } })
    userB = await db.user.create({ data: { email: `user-b-${sufixo}@example.com`, name: 'Usuário B' } })

    await db.membroServentia.create({ data: { userId: userA.id, serventiaId: serventiaA.id, papel: 'TITULAR' } })
    await db.membroServentia.create({ data: { userId: userB.id, serventiaId: serventiaB.id, papel: 'TITULAR' } })

    progressoA = await db.progressoRequisito.create({
      data: { serventiaId: serventiaA.id, requisitoId: requisito.id, status: 'EM_ANDAMENTO' },
    })
    evidenciaA = await db.evidencia.create({
      data: {
        progressoRequisitoId: progressoA.id,
        nomeArquivo: 'evidencia-teste.pdf',
        storagePath: `${serventiaA.id}/${progressoA.id}/evidencia-teste.pdf`,
        hashSha256: 'a'.repeat(64),
        tamanhoBytes: 1234,
        uploadedBy: userA.id,
      },
    })
    incidenteA = await db.incidente.create({
      data: {
        serventiaId: serventiaA.id,
        titulo: 'Incidente de teste',
        descricao: 'Descrição de teste',
        dataOcorrencia: new Date(),
        dataCiencia: new Date(),
        gravidade: 'CRITICO',
      },
    })
  })

  afterAll(async () => {
    await db.evidencia.deleteMany({ where: { id: evidenciaA?.id } })
    await db.incidente.deleteMany({ where: { id: incidenteA?.id } })
    await db.progressoRequisito.deleteMany({ where: { id: progressoA?.id } })
    await db.membroServentia.deleteMany({ where: { serventiaId: { in: [serventiaA?.id, serventiaB?.id] } } })
    await db.user.deleteMany({ where: { id: { in: [userA?.id, userB?.id] } } })
    await db.serventia.deleteMany({ where: { id: { in: [serventiaA?.id, serventiaB?.id] } } })
  })

  it('Usuário sem vínculo com a serventia não obtém membership (requireServentiaMembro)', async () => {
    const membroCruzado = await requireServentiaMembro(userA.id, serventiaB.id)
    expect(membroCruzado).toBeNull()
  })

  it('Usuário com vínculo correto obtém membership normalmente', async () => {
    const membro = await requireServentiaMembro(userA.id, serventiaA.id)
    expect(membro).not.toBeNull()
    expect(membro?.serventiaId).toBe(serventiaA.id)
  })

  it('Evidência de A não aparece em consulta escopada para B', async () => {
    const evidenciasDeB = await db.evidencia.findMany({
      where: { progressoRequisito: { serventiaId: serventiaB.id } },
    })
    expect(evidenciasDeB.find((e) => e.id === evidenciaA.id)).toBeUndefined()
  })

  it('Evidência de A aparece em consulta escopada para A', async () => {
    const evidenciasDeA = await db.evidencia.findMany({
      where: { progressoRequisito: { serventiaId: serventiaA.id } },
    })
    expect(evidenciasDeA.some((e) => e.id === evidenciaA.id)).toBe(true)
  })

  it('Incidente de A não aparece em consulta escopada para B', async () => {
    const incidentesDeB = await db.incidente.findMany({ where: { serventiaId: serventiaB.id } })
    expect(incidentesDeB.find((i) => i.id === incidenteA.id)).toBeUndefined()
  })

  it('Progresso de requisito de A não aparece em consulta escopada para B', async () => {
    const progressosDeB = await db.progressoRequisito.findMany({
      where: { serventiaId: serventiaB.id, requisitoId: requisito.id },
    })
    expect(progressosDeB.find((p) => p.id === progressoA.id)).toBeUndefined()
  })
})
