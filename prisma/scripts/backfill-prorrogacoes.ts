/**
 * Backfill único: converte qualquer Serventia.prorrogacaoAtiva=true (campos
 * legados, deprecated) em um registro `Prorrogacao(status=DEFERIDA)`.
 *
 * Rodar UMA VEZ em produção antes de qualquer remoção futura das colunas
 * antigas (Serventia.prorrogacaoAtiva/prorrogacaoJustificativa/prorrogacaoNovaData).
 * Idempotente: não duplica se já existir uma Prorrogacao DEFERIDA para a
 * serventia com o mesmo tipoPrazo.
 *
 * Uso: npx tsx prisma/scripts/backfill-prorrogacoes.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const TIPO_PRAZO_ETAPAS_1_2 = 'ETAPAS_1_2'

async function main() {
  const serventias = await prisma.serventia.findMany({
    where: { prorrogacaoAtiva: true, prorrogacaoNovaData: { not: null } },
  })

  console.log(`Encontradas ${serventias.length} serventia(s) com prorrogacaoAtiva=true.`)

  let criadas = 0
  let ignoradas = 0

  for (const serventia of serventias) {
    const jaExiste = await prisma.prorrogacao.findFirst({
      where: { serventiaId: serventia.id, tipoPrazo: TIPO_PRAZO_ETAPAS_1_2, status: 'DEFERIDA' },
    })
    if (jaExiste) {
      console.log(`  [ignorada] ${serventia.nome} (${serventia.cns}) já tem Prorrogacao DEFERIDA.`)
      ignoradas++
      continue
    }

    await prisma.prorrogacao.create({
      data: {
        serventiaId: serventia.id,
        tipoPrazo: TIPO_PRAZO_ETAPAS_1_2,
        dataOriginal: serventia.dataVigenciaNorma,
        dataSolicitada: serventia.prorrogacaoNovaData!,
        fluxo: serventia.classe === 'CLASSE_1' ? 'SIMPLIFICADO' : 'FORMAL',
        justificativa: serventia.prorrogacaoJustificativa?.trim() || 'Migrado automaticamente dos campos legados da Serventia (backfill).',
        status: 'DEFERIDA',
        solicitadoPor: 'backfill-prorrogacoes.ts',
        decididoPor: 'Migração automática (dados pré-existentes)',
        dataDecisao: new Date(),
      },
    })
    console.log(`  [criada] ${serventia.nome} (${serventia.cns}) — nova data ${serventia.prorrogacaoNovaData!.toISOString().slice(0, 10)}.`)
    criadas++
  }

  console.log(`Concluído: ${criadas} registro(s) criado(s), ${ignoradas} ignorado(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
