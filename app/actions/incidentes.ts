'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'

const incidenteSchema = z.object({
  titulo: z.string().min(3),
  descricao: z.string().min(3),
  dataOcorrencia: z.string().transform((s) => new Date(s)),
  dataCiencia: z.string().transform((s) => new Date(s)),
  gravidade: z.enum(['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] as const),
})

/**
 * Art. 11, §3º: gestão de vulnerabilidades e incidentes exige envolvimento
 * ativo — apenas AUDITOR_LEITURA fica de fora, pois é papel só-leitura.
 */
async function garantirPodeEditar(userId: string, serventiaId: string) {
  const membro = await requireServentiaMembro(userId, serventiaId)
  if (!membro || membro.papel === 'AUDITOR_LEITURA') {
    return null
  }
  return membro
}

export async function criarIncidente(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await garantirPodeEditar(session.user.id, serventiaId)
  if (!membro) return { error: 'Sem permissão para registrar incidentes' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = incidenteSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos.' }

  const incidente = await db.incidente.create({
    data: { serventiaId, ...parsed.data },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'INCIDENTE_CRIADO',
    entidade: 'Incidente',
    entidadeId: incidente.id,
    valorNovo: { titulo: incidente.titulo, gravidade: incidente.gravidade },
  })

  revalidatePath('/incidentes')
  return { success: true, id: incidente.id }
}

const atualizacaoSchema = z.object({
  status: z.enum(['ABERTO', 'EM_TRATAMENTO', 'ENCERRADO'] as const).optional(),
  causaRaiz: z.string().optional(),
  medidasCorretivas: z.string().optional(),
})

export async function atualizarIncidente(serventiaId: string, incidenteId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await garantirPodeEditar(session.user.id, serventiaId)
  if (!membro) return { error: 'Sem permissão' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = atualizacaoSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos' }

  const anterior = await db.incidente.findFirst({ where: { id: incidenteId, serventiaId } })
  if (!anterior) return { error: 'Incidente não encontrado' }

  // Art. 11, §2º: análise de causa raiz e medidas corretivas são exigidas
  // para o encerramento — não se permite fechar um incidente sem elas.
  if (parsed.data.status === 'ENCERRADO') {
    const causaRaiz = parsed.data.causaRaiz ?? anterior.causaRaiz
    const medidas = parsed.data.medidasCorretivas ?? anterior.medidasCorretivas
    if (!causaRaiz?.trim() || !medidas?.trim()) {
      return { error: 'Para encerrar, registre a análise de causa raiz e as medidas corretivas (Art. 11, §2º).' }
    }
  }

  const incidente = await db.incidente.update({
    where: { id: incidenteId },
    data: parsed.data,
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: incidente.status === 'ENCERRADO' ? 'INCIDENTE_ENCERRADO' : 'INCIDENTE_ATUALIZADO',
    entidade: 'Incidente',
    entidadeId: incidente.id,
    valorAnterior: { status: anterior.status },
    valorNovo: { status: incidente.status },
  })

  revalidatePath('/incidentes')
  return { success: true }
}

/**
 * Art. 11, §1º: comunicação do incidente crítico à Corregedoria em até 72h.
 * Registra a data efetiva da comunicação para o cálculo de aderência ao prazo.
 */
export async function comunicarCorregedoria(serventiaId: string, incidenteId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await garantirPodeEditar(session.user.id, serventiaId)
  if (!membro) return { error: 'Sem permissão' }

  const incidente = await db.incidente.update({
    where: { id: incidenteId },
    data: { comunicadoCorregedoria: true, dataComunicacao: new Date() },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'INCIDENTE_COMUNICADO_CORREGEDORIA',
    entidade: 'Incidente',
    entidadeId: incidente.id,
    valorNovo: { dataComunicacao: incidente.dataComunicacao },
  })

  revalidatePath('/incidentes')
  return { success: true }
}

/** Art. 7º, §3º; Anexo II, item 4, V: incidentes com dados pessoais também vão à ANPD. */
export async function comunicarAnpd(serventiaId: string, incidenteId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await garantirPodeEditar(session.user.id, serventiaId)
  if (!membro) return { error: 'Sem permissão' }

  const incidente = await db.incidente.update({
    where: { id: incidenteId },
    data: { comunicadoAnpd: true },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'INCIDENTE_COMUNICADO_ANPD',
    entidade: 'Incidente',
    entidadeId: incidente.id,
  })

  revalidatePath('/incidentes')
  return { success: true }
}
