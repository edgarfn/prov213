-- Prorrogação de prazo estruturada (Art. 21): histórico completo de pedidos,
-- substituindo os campos soltos Serventia.prorrogacaoAtiva/
-- prorrogacaoJustificativa/prorrogacaoNovaData (mantidos por 1 ciclo de
-- release, marcados @deprecated no schema.prisma). Migration puramente
-- aditiva — nenhuma coluna existente é removida ou reescrita aqui. Antes de
-- remover as colunas antigas em uma migration futura, rode
-- prisma/scripts/backfill-prorrogacoes.ts para migrar qualquer prorrogação
-- ativa já registrada nesses campos para esta nova tabela.

CREATE TYPE "StatusProrrogacao" AS ENUM ('SOLICITADA', 'DEFERIDA', 'INDEFERIDA');
CREATE TYPE "FluxoProrrogacao" AS ENUM ('SIMPLIFICADO', 'FORMAL');

CREATE TABLE "Prorrogacao" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "tipoPrazo" TEXT NOT NULL,
    "dataOriginal" TIMESTAMP(3) NOT NULL,
    "dataSolicitada" TIMESTAMP(3) NOT NULL,
    "fluxo" "FluxoProrrogacao" NOT NULL,
    "justificativa" TEXT NOT NULL,
    "elementosProbatorios" TEXT,
    "status" "StatusProrrogacao" NOT NULL DEFAULT 'SOLICITADA',
    "solicitadoPor" TEXT NOT NULL,
    "dataSolicitacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoPor" TEXT,
    "dataDecisao" TIMESTAMP(3),
    "observacoesDecisao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prorrogacao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prorrogacao_serventiaId_status_idx" ON "Prorrogacao"("serventiaId", "status");

ALTER TABLE "Prorrogacao" ADD CONSTRAINT "Prorrogacao_serventiaId_fkey"
  FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
