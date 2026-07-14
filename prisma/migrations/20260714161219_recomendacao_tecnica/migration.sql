-- CreateEnum
CREATE TYPE "StatusRecomendacao" AS ENUM ('RASCUNHO', 'COMPLEMENTACAO_SOLICITADA', 'AGUARDANDO_PARECER_DPO', 'AGUARDANDO_DECISAO', 'REJEITADO', 'RISCO_ACEITO_TEMPORARIO', 'APROVADO_AGUARDANDO_IMPLEMENTACAO', 'EM_IMPLEMENTACAO', 'AGUARDANDO_ACEITE', 'AGUARDANDO_ATUALIZACAO_DOCUMENTOS', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "DecisaoControlador" AS ENUM ('APROVADO_INTEGRAL', 'APROVADO_COM_CONDICOES', 'APROVADO_IMPLANTACAO_FUTURA', 'COMPLEMENTACAO_SOLICITADA', 'REJEITADO', 'RISCO_ACEITO_TEMPORARIO', 'SUBSTITUIDO_EQUIVALENTE');

-- AlterTable
ALTER TABLE "Evidencia" ADD COLUMN     "recomendacaoTecnicaId" TEXT;

-- CreateTable
CREATE TABLE "RecomendacaoTecnica" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "status" "StatusRecomendacao" NOT NULL DEFAULT 'RASCUNHO',
    "prioridade" "ClassificacaoRisco" NOT NULL,
    "classificacaoRiscoFinal" "ClassificacaoRisco",
    "envolveDadosPessoais" BOOLEAN NOT NULL DEFAULT false,
    "dataIdentificacao" TIMESTAMP(3) NOT NULL,
    "prazoRecomendado" TIMESTAMP(3),
    "responsavelTecnicoId" TEXT NOT NULL,
    "recomendacao" JSONB NOT NULL,
    "analiseRisco" JSONB,
    "parecerDpoUserId" TEXT,
    "parecerDpoConcluidoEm" TIMESTAMP(3),
    "parecerDpo" JSONB,
    "decisao" "DecisaoControlador",
    "decisaoControladorUserId" TEXT,
    "dataDecisao" TIMESTAMP(3),
    "valorAutorizado" DOUBLE PRECISION,
    "prazoImplantacao" TIMESTAMP(3),
    "responsavelExecucaoId" TEXT,
    "decisaoDetalhes" JSONB,
    "prazoReavaliacao" TIMESTAMP(3),
    "termoCiencia" JSONB,
    "dataExecucaoPlanejada" TIMESTAMP(3),
    "ordemEmitidaPorUserId" TEXT,
    "ordemEmitidaEm" TIMESTAMP(3),
    "ordemImplementacao" JSONB,
    "dataExecucaoRealizada" TIMESTAMP(3),
    "execucao" JSONB,
    "aceiteResultado" "ConformidadeTeste",
    "aceiteTecnicoUserId" TEXT,
    "aceiteControladorUserId" TEXT,
    "dataAceite" TIMESTAMP(3),
    "aceite" JSONB,
    "documentosAtualizadosEm" TIMESTAMP(3),
    "documentosAtualizados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecomendacaoTecnica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecomendacaoSequencial" (
    "serventiaId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecomendacaoSequencial_pkey" PRIMARY KEY ("serventiaId","ano")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecomendacaoTecnica_codigo_key" ON "RecomendacaoTecnica"("codigo");

-- CreateIndex
CREATE INDEX "RecomendacaoTecnica_serventiaId_status_idx" ON "RecomendacaoTecnica"("serventiaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecomendacaoTecnica_serventiaId_anoReferencia_sequencial_key" ON "RecomendacaoTecnica"("serventiaId", "anoReferencia", "sequencial");

-- CreateIndex
CREATE INDEX "Evidencia_recomendacaoTecnicaId_idx" ON "Evidencia"("recomendacaoTecnicaId");

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_recomendacaoTecnicaId_fkey" FOREIGN KEY ("recomendacaoTecnicaId") REFERENCES "RecomendacaoTecnica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_responsavelTecnicoId_fkey" FOREIGN KEY ("responsavelTecnicoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_parecerDpoUserId_fkey" FOREIGN KEY ("parecerDpoUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_decisaoControladorUserId_fkey" FOREIGN KEY ("decisaoControladorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_responsavelExecucaoId_fkey" FOREIGN KEY ("responsavelExecucaoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_ordemEmitidaPorUserId_fkey" FOREIGN KEY ("ordemEmitidaPorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_aceiteTecnicoUserId_fkey" FOREIGN KEY ("aceiteTecnicoUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoTecnica" ADD CONSTRAINT "RecomendacaoTecnica_aceiteControladorUserId_fkey" FOREIGN KEY ("aceiteControladorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomendacaoSequencial" ADD CONSTRAINT "RecomendacaoSequencial_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evidências agora também podem se originar de uma RecomendacaoTecnica. O
-- CHECK de origem única (não gerenciado pelo Prisma, ver migration
-- 20260705044601_vulnerabilidades_completude) passa a exigir exatamente uma
-- das cinco origens preenchida.
ALTER TABLE "Evidencia" DROP CONSTRAINT "Evidencia_origem_unica_check";
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_origem_unica_check" CHECK (
  (
    (CASE WHEN "progressoRequisitoId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "testeRestauracaoId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "incidenteId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "vulnerabilidadeId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "recomendacaoTecnicaId" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);
