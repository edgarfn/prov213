'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { podeDeclaraEtapa } from '@/lib/business-rules'
import { runLogged } from '@/lib/logger'

const progressoSchema = z.object({
  status: z.enum(['NAO_INICIADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'NAO_APLICAVEL'] as const),
  observacoes: z.string().optional(),
  solucaoAdotada: z.string().optional(),
  // Anexo IV, item VII, "c" — usada no Relatório Simplificado da Classe 1
  demonstracaoEquivalencia: z.string().optional(),
})

export async function atualizarProgresso(
  serventiaId: string,
  requisitoId: string,
  formData: FormData,
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId, serventiaId } },
  })
  if (!membro || membro.papel === 'AUDITOR_LEITURA') {
    return { error: 'Sem permissão para editar' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = progressoSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos' }

  const anterior = await db.progressoRequisito.findUnique({
    where: { serventiaId_requisitoId: { serventiaId, requisitoId } },
  })

  const result = await runLogged('atualizarProgresso', { userId, serventiaId, requisitoId }, async () => {
    const progresso = await db.progressoRequisito.upsert({
      where: { serventiaId_requisitoId: { serventiaId, requisitoId } },
      update: {
        ...parsed.data,
        responsavelId: userId,
        dataConclusao: parsed.data.status === 'CONCLUIDO' ? new Date() : null,
      },
      create: {
        serventiaId,
        requisitoId,
        ...parsed.data,
        responsavelId: userId,
        dataConclusao: parsed.data.status === 'CONCLUIDO' ? new Date() : null,
      },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: 'PROGRESSO_ATUALIZADO',
      entidade: 'ProgressoRequisito',
      entidadeId: progresso.id,
      valorAnterior: anterior ? { status: anterior.status } : null,
      valorNovo: { status: parsed.data.status, requisitoId },
    })
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/checklists')
  return { success: true }
}

export async function declaraConclusaoEtapa(serventiaId: string, etapaId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId, serventiaId } },
  })
  if (!membro || membro.papel !== 'TITULAR') {
    return { error: 'Apenas o Titular pode declarar conclusão de etapa' }
  }

  const etapa = await db.etapa.findUnique({ where: { id: etapaId } })
  if (!etapa) return { error: 'Etapa não encontrada' }

  // Fonte única da regra de sequencialidade: lib/business-rules.ts::podeDeclaraEtapa.
  // As consultas abaixo só resolvem os parâmetros primitivos que a função pura precisa.
  let etapaAnteriorDeclarada = true
  if (etapa.numero > 1) {
    const etapaAnterior = await db.etapa.findUnique({
      where: { numero: etapa.numero - 1 },
    })
    if (etapaAnterior) {
      const declaracaoAnterior = await db.declaracao.findUnique({
        where: { serventiaId_etapaId: { serventiaId, etapaId: etapaAnterior.id } },
      })
      etapaAnteriorDeclarada = !!declaracaoAnterior
    }
  }

  const requisitosEtapa = await db.requisito.findMany({
    where: { etapaId },
    include: {
      progressos: { where: { serventiaId } },
    },
  })

  const naoConcluidosObrigatorios = requisitosEtapa.filter(
    (r) =>
      r.obrigatorio &&
      (!r.progressos[0] || !['CONCLUIDO', 'NAO_APLICAVEL'].includes(r.progressos[0].status)),
  )
  const progressoConcluido = naoConcluidosObrigatorios.length === 0
  const etapasDeclaradas = etapaAnteriorDeclarada ? [etapa.numero - 1] : []

  if (!podeDeclaraEtapa(etapa.numero, etapasDeclaradas, progressoConcluido)) {
    if (!etapaAnteriorDeclarada) {
      return { error: `Etapa ${etapa.numero - 1} ainda não foi declarada concluída.` }
    }
    return {
      error: `${naoConcluidosObrigatorios.length} requisito(s) obrigatório(s) ainda não concluído(s).`,
    }
  }

  const user = await db.user.findUnique({ where: { id: userId } })

  const result = await runLogged('declaraConclusaoEtapa', { userId, serventiaId, etapaId }, async () => {
    await db.declaracao.upsert({
      where: { serventiaId_etapaId: { serventiaId, etapaId } },
      update: { dataDeclaracao: new Date(), declarante: user?.name ?? session.user.email ?? '' },
      create: {
        serventiaId,
        etapaId,
        declarante: user?.name ?? session.user.email ?? '',
      },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: 'ETAPA_DECLARADA',
      entidade: 'Etapa',
      entidadeId: etapaId,
      valorNovo: { etapaNumero: etapa.numero, etapaTitulo: etapa.titulo },
    })
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/checklists')
  return { success: true }
}
