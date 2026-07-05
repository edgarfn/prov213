-- CreateEnum
CREATE TYPE "ClassificacaoRisco" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "StatusVulnerabilidade" AS ENUM ('IDENTIFICADA', 'EM_CORRECAO', 'CORRIGIDA', 'RISCO_ACEITO', 'FALSO_POSITIVO');

-- CreateEnum
CREATE TYPE "OrigemVulnerabilidade" AS ENUM ('PENTESTE', 'SCANNER_AUTOMATIZADO', 'REPORTE_INTERNO', 'REPORTE_EXTERNO', 'AUDITORIA', 'FORNECEDOR_CVE', 'OUTRO');

-- AlterTable
ALTER TABLE "Evidencia" ADD COLUMN "vulnerabilidadeId" TEXT;

-- AlterTable
ALTER TABLE "Vulnerabilidade" ADD COLUMN "ativoAfetado" TEXT,
ADD COLUMN "cveReferencia" TEXT,
ADD COLUMN "cvssScore" DOUBLE PRECISION,
ADD COLUMN "justificativaRiscoAceito" TEXT,
ADD COLUMN "origem" "OrigemVulnerabilidade" NOT NULL DEFAULT 'OUTRO',
ADD COLUMN "responsavelId" TEXT,
ADD COLUMN "status" "StatusVulnerabilidade" NOT NULL DEFAULT 'IDENTIFICADA';

-- "classificacaoRisco" era texto livre. Convertida para enum SEM apagar dados:
-- coluna nova nullable, backfill por melhor esforço a partir do texto antigo,
-- e só então NOT NULL — ao contrário de um simples "drop column" + "add
-- column" (que apagaria valores existentes e quebraria com NOT NULL em
-- qualquer linha já cadastrada). Valor não reconhecido vira CRITICO
-- (nunca sub-classificar um risco por segurança, é preferível pedir revisão
-- manual do que subestimar um risco já registrado).
ALTER TABLE "Vulnerabilidade" ADD COLUMN "classificacaoRiscoNovo" "ClassificacaoRisco";

UPDATE "Vulnerabilidade" SET "classificacaoRiscoNovo" = CASE
  WHEN "classificacaoRisco" ILIKE 'bai%'  THEN 'BAIXO'::"ClassificacaoRisco"
  WHEN "classificacaoRisco" ILIKE 'med%'  THEN 'MEDIO'::"ClassificacaoRisco"
  WHEN "classificacaoRisco" ILIKE 'alt%'  THEN 'ALTO'::"ClassificacaoRisco"
  WHEN "classificacaoRisco" ILIKE 'cri%'  THEN 'CRITICO'::"ClassificacaoRisco"
  ELSE 'CRITICO'::"ClassificacaoRisco"
END;

ALTER TABLE "Vulnerabilidade" DROP COLUMN "classificacaoRisco";
ALTER TABLE "Vulnerabilidade" RENAME COLUMN "classificacaoRiscoNovo" TO "classificacaoRisco";
ALTER TABLE "Vulnerabilidade" ALTER COLUMN "classificacaoRisco" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Evidencia_vulnerabilidadeId_idx" ON "Evidencia"("vulnerabilidadeId");

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_vulnerabilidadeId_fkey" FOREIGN KEY ("vulnerabilidadeId") REFERENCES "Vulnerabilidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vulnerabilidade" ADD CONSTRAINT "Vulnerabilidade_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Evidências agora também podem se originar de uma Vulnerabilidade (laudo de
-- scan, print de correção aplicada). O CHECK de origem única passa a exigir
-- exatamente uma das quatro origens preenchida.
ALTER TABLE "Evidencia" DROP CONSTRAINT "Evidencia_origem_unica_check";

ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_origem_unica_check" CHECK (
  (
    (CASE WHEN "progressoRequisitoId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "testeRestauracaoId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "incidenteId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "vulnerabilidadeId" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);
