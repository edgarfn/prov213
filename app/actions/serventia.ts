'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
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

  const raw = Object.fromEntries(formData.entries())
  const parsed = serventiaSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Dados inválidos.', issues: parsed.error.issues }
  }

  const serventia = await db.serventia.create({
    data: { ...parsed.data, onboardingConcluido: true },
  })

  await db.membroServentia.create({
    data: {
      userId: session.user.id,
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
    userId: session.user.id,
    acao: 'SERVENTIA_CRIADA',
    entidade: 'Serventia',
    entidadeId: serventia.id,
    valorNovo: { nome: serventia.nome, classe: serventia.classe },
  })

  revalidatePath('/dashboard')
  return { success: true, serventiaId: serventia.id }
}

export async function atualizarServentia(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId: session.user.id, serventiaId } },
  })
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return { error: 'Sem permissão' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = serventiaSchema.partial().safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos' }

  await db.serventia.update({
    where: { id: serventiaId },
    data: { ...parsed.data, onboardingConcluido: true },
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function concluirOnboarding(serventiaId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  await db.serventia.update({
    where: { id: serventiaId },
    data: { onboardingConcluido: true },
  })

  revalidatePath('/dashboard')
  return { success: true }
}
