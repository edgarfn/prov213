'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'
import { prazoVulnerabilidade } from '@/lib/business-rules'

const vulnerabilidadeSchema = z.object({
  descricao: z.string().min(3),
  dataIdentificacao: z.string().transform((s) => new Date(s)),
  classificacaoRisco: z.string().min(2),
  exploracaoAtiva: z.coerce.boolean().default(false),
})

async function garantirPodeEditar(userId: string, serventiaId: string) {
  const membro = await requireServentiaMembro(userId, serventiaId)
  if (!membro || membro.papel === 'AUDITOR_LEITURA') return null
  return membro
}

/**
 * Art. 11, §3º; Anexo II, item 5, II: crítica sem exploração ativa = 30 dias;
 * exploração ativa/risco iminente = 72h. O prazo é recalculado sempre que
 * `exploracaoAtiva` muda (uma vulnerabilidade pode passar a ser ativamente
 * explorada depois de identificada).
 */
export async function criarVulnerabilidade(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await garantirPodeEditar(session.user.id, serventiaId)
  if (!membro) return { error: 'Sem permissão para registrar vulnerabilidades' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = vulnerabilidadeSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos.' }

  const prazoLimite = prazoVulnerabilidade(parsed.data.dataIdentificacao, parsed.data.exploracaoAtiva)

  const vulnerabilidade = await db.vulnerabilidade.create({
    data: { serventiaId, ...parsed.data, prazoLimite },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'VULNERABILIDADE_CRIADA',
    entidade: 'Vulnerabilidade',
    entidadeId: vulnerabilidade.id,
    valorNovo: { classificacaoRisco: vulnerabilidade.classificacaoRisco, exploracaoAtiva: vulnerabilidade.exploracaoAtiva },
  })

  revalidatePath('/vulnerabilidades')
  return { success: true, id: vulnerabilidade.id }
}

const atualizacaoSchema = z.object({
  exploracaoAtiva: z.coerce.boolean().optional(),
  providencias: z.string().optional(),
  encerrar: z.coerce.boolean().optional(),
})

export async function atualizarVulnerabilidade(serventiaId: string, vulnerabilidadeId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const membro = await garantirPodeEditar(session.user.id, serventiaId)
  if (!membro) return { error: 'Sem permissão' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = atualizacaoSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos' }

  const anterior = await db.vulnerabilidade.findFirst({ where: { id: vulnerabilidadeId, serventiaId } })
  if (!anterior) return { error: 'Vulnerabilidade não encontrada' }

  // Art. 11, §4º: providências devem estar registradas para encerramento formal.
  if (parsed.data.encerrar && !(parsed.data.providencias ?? anterior.providencias)?.trim()) {
    return { error: 'Registre as providências adotadas antes de encerrar (Art. 11, §4º).' }
  }

  const exploracaoAtiva = parsed.data.exploracaoAtiva ?? anterior.exploracaoAtiva
  const prazoLimite =
    exploracaoAtiva !== anterior.exploracaoAtiva
      ? prazoVulnerabilidade(anterior.dataIdentificacao, exploracaoAtiva)
      : anterior.prazoLimite

  const vulnerabilidade = await db.vulnerabilidade.update({
    where: { id: vulnerabilidadeId },
    data: {
      exploracaoAtiva,
      prazoLimite,
      providencias: parsed.data.providencias ?? anterior.providencias,
      dataEncerramento: parsed.data.encerrar ? new Date() : anterior.dataEncerramento,
    },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: parsed.data.encerrar ? 'VULNERABILIDADE_ENCERRADA' : 'VULNERABILIDADE_ATUALIZADA',
    entidade: 'Vulnerabilidade',
    entidadeId: vulnerabilidade.id,
    valorAnterior: { exploracaoAtiva: anterior.exploracaoAtiva },
    valorNovo: { exploracaoAtiva: vulnerabilidade.exploracaoAtiva, dataEncerramento: vulnerabilidade.dataEncerramento },
  })

  revalidatePath('/vulnerabilidades')
  return { success: true }
}
