/**
 * Regras puras do processo de Recomendação Técnica e Decisão do Controlador
 * (governança de TI/LGPD em 8 etapas). Nenhuma função aqui acessa o banco —
 * a orquestração (leitura/escrita via Prisma) fica em
 * app/actions/recomendacao-tecnica.ts.
 */
import { db } from '@/lib/db'
import type { StatusRecomendacao, DecisaoControlador, ConformidadeTeste } from '@/app/generated/prisma/enums'

const DECISOES_TERMINAIS: Partial<Record<DecisaoControlador, StatusRecomendacao>> = {
  REJEITADO: 'REJEITADO',
  RISCO_ACEITO_TEMPORARIO: 'RISCO_ACEITO_TEMPORARIO',
  COMPLEMENTACAO_SOLICITADA: 'COMPLEMENTACAO_SOLICITADA',
}

/** Etapa 2 → Etapa 3 (se envolver dados pessoais) ou direto para Etapa 4. */
export function proximoStatusAposAnaliseRisco(envolveDadosPessoais: boolean): StatusRecomendacao {
  return envolveDadosPessoais ? 'AGUARDANDO_PARECER_DPO' : 'AGUARDANDO_DECISAO'
}

/**
 * Etapa 4 (Decisão do Controlador). REJEITADO/RISCO_ACEITO_TEMPORARIO são
 * estados terminais próprios; COMPLEMENTACAO_SOLICITADA reabre as Etapas 1/2;
 * os demais 4 valores (aprovações e substituição por equivalente) liberam a
 * Etapa 5 (Ordem de Implementação).
 */
export function proximoStatusAposDecisao(decisao: DecisaoControlador): StatusRecomendacao {
  return DECISOES_TERMINAIS[decisao] ?? 'APROVADO_AGUARDANDO_IMPLEMENTACAO'
}

/** Termo de Ciência (GOV-TI-09) só é exigido nesses dois desfechos. */
export function exigeTermoCiencia(decisao: DecisaoControlador): boolean {
  return decisao === 'REJEITADO' || decisao === 'RISCO_ACEITO_TEMPORARIO'
}

/**
 * Etapa 7 (Teste e Aceite). NAO_CONFORME manda de volta para execução
 * (retrabalho); INTEGRAL/PARCIAL libera a Etapa 8 (atualização de
 * documentos de governança).
 */
export function proximoStatusAposAceite(resultado: ConformidadeTeste): StatusRecomendacao {
  return resultado === 'NAO_CONFORME' ? 'EM_IMPLEMENTACAO' : 'AGUARDANDO_ATUALIZACAO_DOCUMENTOS'
}

/** Formata o código legível RT-{CNS}-{ANO}-{SEQ}, ex.: RT-12345-2026-001. */
export function formatarCodigoRecomendacao(cns: string, ano: number, sequencial: number): string {
  return `RT-${cns}-${ano}-${String(sequencial).padStart(3, '0')}`
}

/**
 * Gera o próximo código sequencial de forma segura contra corrida: o
 * UPSERT em RecomendacaoSequencial toma um lock de linha em
 * (serventiaId, ano) no Postgres — uma segunda transação concorrente espera
 * e só então lê o número já incrementado, nunca duplicando um código.
 */
export async function proximoCodigoRecomendacao(
  tx: Pick<typeof db, 'recomendacaoSequencial'>,
  serventiaId: string,
  cns: string,
  ano: number,
): Promise<{ codigo: string; sequencial: number }> {
  const seq = await tx.recomendacaoSequencial.upsert({
    where: { serventiaId_ano: { serventiaId, ano } },
    create: { serventiaId, ano, ultimoNumero: 1 },
    update: { ultimoNumero: { increment: 1 } },
  })
  return { codigo: formatarCodigoRecomendacao(cns, ano, seq.ultimoNumero), sequencial: seq.ultimoNumero }
}
