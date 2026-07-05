-- CreateEnum
CREATE TYPE "ClasseServentia" AS ENUM ('CLASSE_1', 'CLASSE_2', 'CLASSE_3');

-- CreateEnum
CREATE TYPE "SubclasseServentia" AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J');

-- CreateEnum
CREATE TYPE "TipoSolucao" AS ENUM ('PROPRIA', 'CONTRATADA', 'COMPARTILHADA', 'COLETIVA');

-- CreateEnum
CREATE TYPE "TipoInfra" AS ENUM ('LOCAL', 'NUVEM', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "RolePapel" AS ENUM ('TITULAR', 'RESPONSAVEL_TECNICO', 'DPO', 'COLABORADOR', 'AUDITOR_LEITURA');

-- CreateEnum
CREATE TYPE "StatusRequisito" AS ENUM ('NAO_INICIADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "TipoEvidencia" AS ENUM ('DOCUMENTO', 'CONTRATO', 'PRINT', 'LOG', 'RELATORIO', 'ATA');

-- CreateEnum
CREATE TYPE "GravidadeIncidente" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "StatusIncidente" AS ENUM ('ABERTO', 'EM_TRATAMENTO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "ConformidadeTeste" AS ENUM ('INTEGRAL', 'PARCIAL', 'NAO_CONFORME');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "passwordHash" TEXT,
    "image" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Serventia" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cns" TEXT NOT NULL,
    "cnpj" TEXT,
    "municipio" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "classe" "ClasseServentia" NOT NULL,
    "subclasse" "SubclasseServentia",
    "arrecadacaoSemestral" DOUBLE PRECISION,
    "tipoSolucao" "TipoSolucao" NOT NULL,
    "infra" "TipoInfra" NOT NULL,
    "dataVigenciaNorma" TIMESTAMP(3) NOT NULL,
    "responsavelTecnico" TEXT,
    "controladorDados" TEXT,
    "dpo" TEXT,
    "prorrogacaoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "prorrogacaoJustificativa" TEXT,
    "prorrogacaoNovaData" TIMESTAMP(3),
    "onboardingConcluido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Serventia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroServentia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "papel" "RolePapel" NOT NULL DEFAULT 'COLABORADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembroServentia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "condicoesObjetivas" TEXT NOT NULL,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisito" (
    "id" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricaoNorma" TEXT NOT NULL,
    "explicacaoLeigo" TEXT NOT NULL,
    "articuloReferencia" TEXT NOT NULL,
    "classesAplicaveis" "ClasseServentia"[],
    "parametrosPorClasse" JSONB,
    "evidenciasExigidas" TEXT[],
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "metaExcelencia" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Requisito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressoRequisito" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "requisitoId" TEXT NOT NULL,
    "status" "StatusRequisito" NOT NULL DEFAULT 'NAO_INICIADO',
    "responsavelId" TEXT,
    "dataConclusao" TIMESTAMP(3),
    "observacoes" TEXT,
    "solucaoAdotada" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressoRequisito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" TEXT NOT NULL,
    "progressoRequisitoId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "tipo" "TipoEvidencia" NOT NULL DEFAULT 'DOCUMENTO',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incidente" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataOcorrencia" TIMESTAMP(3) NOT NULL,
    "dataCiencia" TIMESTAMP(3) NOT NULL,
    "gravidade" "GravidadeIncidente" NOT NULL,
    "status" "StatusIncidente" NOT NULL DEFAULT 'ABERTO',
    "comunicadoCorregedoria" BOOLEAN NOT NULL DEFAULT false,
    "dataComunicacao" TIMESTAMP(3),
    "comunicadoAnpd" BOOLEAN NOT NULL DEFAULT false,
    "causaRaiz" TEXT,
    "medidasCorretivas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incidente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vulnerabilidade" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataIdentificacao" TIMESTAMP(3) NOT NULL,
    "classificacaoRisco" TEXT NOT NULL,
    "exploracaoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "prazoLimite" TIMESTAMP(3) NOT NULL,
    "dataEncerramento" TIMESTAMP(3),
    "providencias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vulnerabilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TesteRestauracao" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "dataTeste" TIMESTAMP(3) NOT NULL,
    "sistemasRestaurados" TEXT[],
    "rtoAferido" DOUBLE PRECISION NOT NULL,
    "rtoDefinido" DOUBLE PRECISION NOT NULL,
    "rpoAferido" DOUBLE PRECISION NOT NULL,
    "rpoDefinido" DOUBLE PRECISION NOT NULL,
    "conformidade" "ConformidadeTeste" NOT NULL,
    "participantes" JSONB,
    "arquiteturaBackup" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TesteRestauracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Declaracao" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "dataDeclaracao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declarante" TEXT NOT NULL,
    "arquivoDeclaracao" TEXT,

    CONSTRAINT "Declaracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "serventiaId" TEXT,
    "userId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "valorAnterior" JSONB,
    "valorNovo" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Serventia_cns_key" ON "Serventia"("cns");

-- CreateIndex
CREATE UNIQUE INDEX "MembroServentia_userId_serventiaId_key" ON "MembroServentia"("userId", "serventiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_numero_key" ON "Etapa"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Requisito_codigo_key" ON "Requisito"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressoRequisito_serventiaId_requisitoId_key" ON "ProgressoRequisito"("serventiaId", "requisitoId");

-- CreateIndex
CREATE UNIQUE INDEX "Declaracao_serventiaId_etapaId_key" ON "Declaracao"("serventiaId", "etapaId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroServentia" ADD CONSTRAINT "MembroServentia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroServentia" ADD CONSTRAINT "MembroServentia_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisito" ADD CONSTRAINT "Requisito_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoRequisito" ADD CONSTRAINT "ProgressoRequisito_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoRequisito" ADD CONSTRAINT "ProgressoRequisito_requisitoId_fkey" FOREIGN KEY ("requisitoId") REFERENCES "Requisito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoRequisito" ADD CONSTRAINT "ProgressoRequisito_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_progressoRequisitoId_fkey" FOREIGN KEY ("progressoRequisitoId") REFERENCES "ProgressoRequisito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vulnerabilidade" ADD CONSTRAINT "Vulnerabilidade_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TesteRestauracao" ADD CONSTRAINT "TesteRestauracao_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaracao" ADD CONSTRAINT "Declaracao_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaracao" ADD CONSTRAINT "Declaracao_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_serventiaId_fkey" FOREIGN KEY ("serventiaId") REFERENCES "Serventia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
