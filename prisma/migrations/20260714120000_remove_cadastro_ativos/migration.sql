-- Reverte o módulo de Cadastro de Ativos Tecnológicos (migration
-- 20260706015449_cadastro_ativos) — fora do escopo original do Provimento
-- CNJ 213/2026 conforme o SPEC do projeto.

-- DropForeignKey
ALTER TABLE "Vulnerabilidade" DROP CONSTRAINT "Vulnerabilidade_ativoId_fkey";

-- DropForeignKey
ALTER TABLE "Ativo" DROP CONSTRAINT "Ativo_serventiaId_fkey";

-- DropForeignKey
ALTER TABLE "Ativo" DROP CONSTRAINT "Ativo_responsavelId_fkey";

-- DropIndex
DROP INDEX "Vulnerabilidade_ativoId_idx";

-- AlterTable
ALTER TABLE "Vulnerabilidade" DROP COLUMN "ativoId";

-- DropTable
DROP TABLE "Ativo";

-- DropEnum
DROP TYPE "TipoAtivo";

-- DropEnum
DROP TYPE "StatusAtivo";
