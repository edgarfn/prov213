-- CreateEnum
CREATE TYPE "CategoriaIncidente" AS ENUM ('ACESSO_NAO_AUTORIZADO', 'MALWARE_RANSOMWARE', 'VAZAMENTO_DADOS', 'INDISPONIBILIDADE_DOS', 'PHISHING_ENGENHARIA_SOCIAL', 'FALHA_CONFIGURACAO', 'PERDA_ROUBO_DISPOSITIVO', 'FISICO', 'OUTRO');

-- DropForeignKey
ALTER TABLE "Evidencia" DROP CONSTRAINT "Evidencia_progressoRequisitoId_fkey";

-- DropForeignKey
ALTER TABLE "Evidencia" DROP CONSTRAINT "Evidencia_testeRestauracaoId_fkey";

-- AlterTable
ALTER TABLE "Evidencia" ADD COLUMN     "incidenteId" TEXT;

-- AlterTable
ALTER TABLE "Incidente" ADD COLUMN     "categoria" "CategoriaIncidente" NOT NULL DEFAULT 'OUTRO',
ADD COLUMN     "categoriasDadosAfetados" TEXT,
ADD COLUMN     "dadosPessoaisEnvolvidos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantidadeTitularesAfetados" INTEGER,
ADD COLUMN     "responsavelId" TEXT,
ADD COLUMN     "riscosTitulares" TEXT;

-- CreateIndex
CREATE INDEX "Evidencia_incidenteId_idx" ON "Evidencia"("incidenteId");

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_progressoRequisitoId_fkey" FOREIGN KEY ("progressoRequisitoId") REFERENCES "ProgressoRequisito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_testeRestauracaoId_fkey" FOREIGN KEY ("testeRestauracaoId") REFERENCES "TesteRestauracao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "Incidente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Evidências agora também podem se originar de um Incidente (evidências de
-- investigação: logs, prints, laudos). O CHECK de origem única (antes só
-- progressoRequisitoId XOR testeRestauracaoId) passa a exigir exatamente uma
-- das três origens preenchida.
ALTER TABLE "Evidencia" DROP CONSTRAINT "Evidencia_origem_unica_check";

ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_origem_unica_check" CHECK (
  (
    (CASE WHEN "progressoRequisitoId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "testeRestauracaoId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "incidenteId" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);
