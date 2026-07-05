-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "hashIntegridade" TEXT,
ADD COLUMN     "userEmail" TEXT,
ADD COLUMN     "userName" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_serventiaId_timestamp_idx" ON "AuditLog"("serventiaId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_acao_idx" ON "AuditLog"("acao");
