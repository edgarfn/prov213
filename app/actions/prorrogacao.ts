'use server'

import { z } from 'zod'
import { addDays } from 'date-fns'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'
import { TIPO_PRAZO_ETAPAS_1_2 } from '@/lib/prorrogacao'

const solicitarSchema = z
  .object({
    dataOriginal: z.string().transform((s) => new Date(s)),
    dataSolicitada: z.string().transform((s) => new Date(s)),
    justificativa: z.string().min(10, 'Descreva a justificativa com mais detalhes'),
    elementosProbatorios: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dataSolicitada <= data.dataOriginal) {
      ctx.addIssue({
        code: 'custom',
        message: 'A nova data deve ser posterior ao prazo original',
        path: ['dataSolicitada'],
      })
    }
    if (data.dataSolicitada > addDays(data.dataOriginal, 90)) {
      ctx.addIssue({
        code: 'custom',
        message: 'A prorrogação não pode exceder 90 dias do prazo original (Art. 21, caput)',
        path: ['dataSolicitada'],
      })
    }
  })

/** Art. 21 — solicitação de prorrogação de até 90 dias, uma única vez */
export async function solicitarProrrogacao(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await requireServentiaMembro(session.user.id, serventiaId)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return { error: 'Apenas Titular ou Responsável Técnico podem solicitar prorrogação' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = solicitarSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }

  const fluxo = membro.serventia.classe === 'CLASSE_1' ? 'SIMPLIFICADO' : 'FORMAL'
  if (fluxo === 'FORMAL' && !parsed.data.elementosProbatorios?.trim()) {
    return {
      error: 'Elementos probatórios (ex.: orçamentos) são obrigatórios para Classes 2 e 3 (Art. 21, §2º)',
    }
  }

  const jaConcedida = await db.prorrogacao.findFirst({
    where: { serventiaId, tipoPrazo: TIPO_PRAZO_ETAPAS_1_2, status: 'DEFERIDA' },
  })
  if (jaConcedida) {
    return { error: 'Já existe uma prorrogação concedida — o Art. 21 permite apenas uma única prorrogação' }
  }

  const pendente = await db.prorrogacao.findFirst({
    where: { serventiaId, tipoPrazo: TIPO_PRAZO_ETAPAS_1_2, status: 'SOLICITADA' },
  })
  if (pendente) {
    return { error: 'Já existe uma solicitação de prorrogação pendente de decisão' }
  }

  const prorrogacao = await db.prorrogacao.create({
    data: {
      serventiaId,
      tipoPrazo: TIPO_PRAZO_ETAPAS_1_2,
      dataOriginal: parsed.data.dataOriginal,
      dataSolicitada: parsed.data.dataSolicitada,
      fluxo,
      justificativa: parsed.data.justificativa,
      elementosProbatorios: parsed.data.elementosProbatorios,
      solicitadoPor: session.user.name ?? session.user.email ?? '',
    },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'PRORROGACAO_SOLICITADA',
    entidade: 'Prorrogacao',
    entidadeId: prorrogacao.id,
    valorNovo: { dataOriginal: parsed.data.dataOriginal, dataSolicitada: parsed.data.dataSolicitada, fluxo },
  })

  revalidatePath('/configuracoes')
  return { success: true }
}

const decisaoSchema = z.object({
  decisao: z.enum(['DEFERIDA', 'INDEFERIDA'] as const),
  decididoPor: z.string().min(1, 'Informe a autoridade que decidiu (Corregedoria competente)'),
  observacoesDecisao: z.string().optional(),
})

/**
 * Registra a decisão da Corregedoria competente sobre um pedido de
 * prorrogação. O sistema não tem contas de usuário da Corregedoria — a
 * decisão é registrada pelo Titular/Responsável Técnico ao recebê-la.
 */
export async function decidirProrrogacao(
  serventiaId: string,
  prorrogacaoId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await requireServentiaMembro(session.user.id, serventiaId)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return { error: 'Apenas Titular ou Responsável Técnico podem registrar a decisão' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = decisaoSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const prorrogacao = await db.prorrogacao.findFirst({ where: { id: prorrogacaoId, serventiaId } })
  if (!prorrogacao) return { error: 'Solicitação de prorrogação não encontrada' }
  if (prorrogacao.status !== 'SOLICITADA') return { error: 'Esta solicitação já foi decidida' }

  await db.prorrogacao.update({
    where: { id: prorrogacaoId },
    data: {
      status: parsed.data.decisao,
      decididoPor: parsed.data.decididoPor,
      dataDecisao: new Date(),
      observacoesDecisao: parsed.data.observacoesDecisao,
    },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'PRORROGACAO_DECIDIDA',
    entidade: 'Prorrogacao',
    entidadeId: prorrogacaoId,
    valorNovo: { decisao: parsed.data.decisao, decididoPor: parsed.data.decididoPor },
  })

  revalidatePath('/configuracoes')
  return { success: true }
}
