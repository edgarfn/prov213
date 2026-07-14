/**
 * Testes de integração da geração concorrente do código sequencial
 * RT-{CNS}-{ANO}-{SEQ}. Exigem um banco Postgres real via DATABASE_URL — rode
 * com `npm run test:integration` (nunca contra produção).
 *
 * Prova que o UPSERT em RecomendacaoSequencial serializa corretamente
 * disparos concorrentes na mesma serventia/ano, nunca gerando dois códigos
 * duplicados (ver lib/recomendacao-tecnica.ts::proximoCodigoRecomendacao).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../../lib/db'
import { proximoCodigoRecomendacao } from '../../lib/recomendacao-tecnica'

describe('proximoCodigoRecomendacao — concorrência', () => {
  let serventia: { id: string; cns: string }
  const sufixo = `test-${Date.now()}`
  const ano = 2026

  beforeAll(async () => {
    serventia = await db.serventia.create({
      data: {
        nome: `Serventia Sequencial ${sufixo}`,
        cns: `SEQ-${sufixo}`,
        municipio: 'Município Teste',
        uf: 'SP',
        classe: 'CLASSE_1',
        tipoSolucao: 'PROPRIA',
        infra: 'NUVEM',
        dataVigenciaNorma: new Date('2026-02-20'),
        onboardingConcluido: true,
      },
    })
  })

  afterAll(async () => {
    await db.recomendacaoSequencial.deleteMany({ where: { serventiaId: serventia.id } })
    await db.serventia.deleteMany({ where: { id: serventia.id } })
  })

  it('gera códigos únicos e sequenciais mesmo sob disparo concorrente', async () => {
    const N = 10
    const resultados = await Promise.all(
      Array.from({ length: N }, () => db.$transaction((tx) => proximoCodigoRecomendacao(tx, serventia.id, serventia.cns, ano))),
    )

    const codigos = resultados.map((r) => r.codigo)
    expect(new Set(codigos).size).toBe(N) // todos únicos, sem duplicatas

    const sequenciais = resultados.map((r) => r.sequencial).sort((a, b) => a - b)
    expect(sequenciais).toEqual(Array.from({ length: N }, (_, i) => i + 1)) // 1..N sem buracos nem repetição

    const contador = await db.recomendacaoSequencial.findUnique({
      where: { serventiaId_ano: { serventiaId: serventia.id, ano } },
    })
    expect(contador?.ultimoNumero).toBe(N)
  })
})
