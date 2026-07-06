-- CreateEnum
CREATE TYPE "TipoAtivo" AS ENUM ('EQUIPAMENTO', 'SISTEMA_SOFTWARE', 'BANCO_DADOS', 'INTEGRACAO', 'CERTIFICADO_DIGITAL', 'CONTRATO_FORNECEDOR', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusAtivo" AS ENUM ('EM_AQUISICAO', 'ATIVO', 'EM_MANUTENCAO', 'DESCONTINUADO', 'BAIXADO');

-- AlterTable
ALTER TABLE "Vulnerabilidade" ADD COLUMN     "ativoId" TEXT;

-- CreateTable
CREATE TABLE "Ativo" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoAtivo" NOT NULL,
    "criticidade" "ClassificacaoRisco" NOT NULL,
    "status" "StatusAtivo" NOT NULL DEFAULT 'ATIVO',
    "fabricante" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "identificadorRede" TEXT,
    "localizacao" TEXT,
    "fornecedor" TEXT,
    "descricao" TEXT,
    "contemDadosPessoais" BOOLEAN NOT NULL DEFAULT false,
    "versaoAtual" TEXT,
    "dataUltimaAtualizacao" TIMESTAMP(3),
    "dataAquisicao" TIMESTAMP(3),
    "dataEntradaProducao" TIMESTAMP(3),
    "dataFimVidaUtil" TIMESTAMP(3),
    "dataBaixa" TIMESTAMP(3),
    "justificativaBaixa" TEXT,
    "responsavelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ativo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ativo_serventiaId_status_idx" ON "Ativo"("serventiaId", "status");

-- CreateIndex
CREATE INDEX "Ativo_serventiaId_dataFimVidaUtil_idx" ON "Ativo"("serventiaId", "dataFimVidaUtil");

-- CreateIndex
CREATE INDEX "Vulnerabilidade_ativoId_idx" ON "Vulnerabilidade"("ativoId");

-- AddForeignKey
ALTER TABLE "Vulnerabilidade" ADD CONSTRAINT "Vulnerabilidade_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ativo" ADD CONSTRAINT "Ativo_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ativo" ADD CONSTRAINT "Ativo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
