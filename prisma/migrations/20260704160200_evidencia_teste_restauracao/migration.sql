-- Evidências passam a poder ser vinculadas a um Teste de Restauração (Anexo V),
-- além de a um Requisito (checklist). A FK progressoRequisitoId torna-se
-- opcional; a nova FK testeRestauracaoId é adicionada; um CHECK garante que
-- exatamente uma das duas origens esteja preenchida. Nenhum dado existente é
-- reescrito — apenas relaxamos a constraint NOT NULL.

ALTER TABLE "Evidencia" ALTER COLUMN "progressoRequisitoId" DROP NOT NULL;
ALTER TABLE "Evidencia" ADD COLUMN "testeRestauracaoId" TEXT;

ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_testeRestauracaoId_fkey"
  FOREIGN KEY ("testeRestauracaoId") REFERENCES "TesteRestauracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Evidencia_testeRestauracaoId_idx" ON "Evidencia"("testeRestauracaoId");

ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_origem_unica_check" CHECK (
  ("progressoRequisitoId" IS NOT NULL AND "testeRestauracaoId" IS NULL) OR
  ("progressoRequisitoId" IS NULL AND "testeRestauracaoId" IS NOT NULL)
);

-- Anexo V, item 8 — providências deliberadas quando a conformidade não é integral
ALTER TABLE "TesteRestauracao" ADD COLUMN "medidasCorretivas" TEXT;
