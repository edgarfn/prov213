/**
 * Prorrogação de prazo (Art. 21) — leitura da tabela `Prorrogacao`, fonte
 * única para saber se há uma nova data de prazo vigente. Substitui a leitura
 * direta de `Serventia.prorrogacaoAtiva/prorrogacaoNovaData` (deprecated).
 */
import { db } from '@/lib/db'

export const TIPO_PRAZO_ETAPAS_1_2 = 'ETAPAS_1_2'

/**
 * Retorna a nova data do prazo se houver uma prorrogação DEFERIDA (a mais
 * recente) para o tipoPrazo informado, ou null caso não haja.
 */
export async function getProrrogacaoAtivaData(
  serventiaId: string,
  tipoPrazo: string = TIPO_PRAZO_ETAPAS_1_2,
): Promise<Date | null> {
  const prorrogacao = await db.prorrogacao.findFirst({
    where: { serventiaId, tipoPrazo, status: 'DEFERIDA' },
    orderBy: { dataDecisao: 'desc' },
  })
  return prorrogacao?.dataSolicitada ?? null
}
