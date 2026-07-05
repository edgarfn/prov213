'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { runLogged } from '@/lib/logger'
import type { ClasseServentia } from '@/types/prisma'

const serventiaSchema = z.object({
  nome: z.string().min(3),
  cns: z.string().min(6),
  cnpj: z.string().optional(),
  municipio: z.string().min(2),
  uf: z.string().length(2),
  classe: z.enum(['CLASSE_1', 'CLASSE_2', 'CLASSE_3'] as const),
  subclasse: z.enum(['A','B','C','D','E','F','G','H','I','J'] as const).optional(),
  arrecadacaoSemestral: z.coerce.number().optional(),
  tipoSolucao: z.enum(['PROPRIA', 'CONTRATADA', 'COMPARTILHADA', 'COLETIVA'] as const),
  infra: z.enum(['LOCAL', 'NUVEM', 'HIBRIDA'] as const),
  dataVigenciaNorma: z.string().transform((s) => new Date(s)),
  responsavelTecnico: z.string().optional(),
  controladorDados: z.string().optional(),
  dpo: z.string().optional(),
})

export async function criarServentia(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const raw = Object.fromEntries(formData.entries())
  const parsed = serventiaSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Dados inválidos.', issues: parsed.error.issues }
  }

  const result = await runLogged('criarServentia', { userId }, async () => {
    const serventia = await db.serventia.create({
      data: { ...parsed.data, onboardingConcluido: true },
    })

    await db.membroServentia.create({
      data: {
        userId,
        serventiaId: serventia.id,
        papel: 'TITULAR',
      },
    })

    const requisitos = await db.requisito.findMany({
      where: {
        classesAplicaveis: { has: parsed.data.classe as ClasseServentia },
      },
    })

    if (requisitos.length > 0) {
      await db.progressoRequisito.createMany({
        data: requisitos.map((r) => ({
          serventiaId: serventia.id,
          requisitoId: r.id,
          status: 'NAO_INICIADO' as const,
        })),
        skipDuplicates: true,
      })
    }

    await logAudit({
      serventiaId: serventia.id,
      userId,
      acao: 'SERVENTIA_CRIADA',
      entidade: 'Serventia',
      entidadeId: serventia.id,
      valorNovo: { nome: serventia.nome, classe: serventia.classe },
    })

    return serventia
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/dashboard')
  return { success: true, serventiaId: result.value.id }
}

export async function atualizarServentia(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId, serventiaId } },
  })
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return { error: 'Sem permissão' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = serventiaSchema.partial().safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos' }

  const result = await runLogged('atualizarServentia', { userId, serventiaId }, async () => {
    const serventia = await db.serventia.update({
      where: { id: serventiaId },
      data: { ...parsed.data, onboardingConcluido: true },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: 'SERVENTIA_ATUALIZADA',
      entidade: 'Serventia',
      entidadeId: serventia.id,
      valorNovo: parsed.data,
    })
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/dashboard')
  revalidatePath('/selecionar-serventia')
  return { success: true }
}

/**
 * Ativar/inativar é uma decisão de maior impacto que editar detalhes: uma
 * serventia inativa fica inacessível para TODOS os seus membros (ver
 * requireServentiaMembro). Por isso, diferente de atualizarServentia
 * (TITULAR ou RESPONSAVEL_TECNICO), esta ação é restrita a TITULAR.
 *
 * A checagem de permissão é feita direto em MembroServentia (não via
 * requireServentiaMembro/getValidatedMembro), pois esse caminho já bloqueia
 * serventias inativas — o TITULAR precisa conseguir reativar mesmo com a
 * serventia já inativa.
 */
export async function alternarAtivaServentia(serventiaId: string, ativa: boolean) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId, serventiaId } },
  })
  if (!membro || membro.papel !== 'TITULAR') {
    return { error: 'Apenas o Titular pode ativar ou inativar a serventia' }
  }

  const result = await runLogged('alternarAtivaServentia', { userId, serventiaId }, async () => {
    const serventia = await db.serventia.update({
      where: { id: serventiaId },
      data: { ativa },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: ativa ? 'SERVENTIA_ATIVADA' : 'SERVENTIA_INATIVADA',
      entidade: 'Serventia',
      entidadeId: serventia.id,
      valorNovo: { ativa },
    })
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/selecionar-serventia')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function concluirOnboarding(serventiaId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const result = await runLogged('concluirOnboarding', { userId, serventiaId }, async () => {
    await db.serventia.update({
      where: { id: serventiaId },
      data: { onboardingConcluido: true },
    })
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/dashboard')
  return { success: true }
}
