'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'
import { runLogged } from '@/lib/logger'

async function garantirPodeEditar(userId: string, serventiaId: string) {
  const membro = await requireServentiaMembro(userId, serventiaId)
  if (!membro || membro.papel === 'AUDITOR_LEITURA') return null
  return membro
}

const participanteSchema = z.object({ nome: z.string().min(1), papel: z.string().min(1) })

const testeSchema = z.object({
  dataTeste: z.string().transform((s) => new Date(s)),
  sistemasRestaurados: z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  rtoDefinido: z.coerce.number().positive(),
  rtoAferido: z.coerce.number().nonnegative(),
  rpoDefinido: z.coerce.number().positive(),
  rpoAferido: z.coerce.number().nonnegative(),
  participantes: z.string().transform((s) => {
    try {
      const parsed = JSON.parse(s)
      return z.array(participanteSchema).parse(parsed)
    } catch {
      return []
    }
  }),
  arquiteturaBackup: z.string().optional().transform((s) => {
    if (!s) return {}
    try {
      return JSON.parse(s) as Record<string, unknown>
    } catch {
      return {}
    }
  }),
})

/**
 * Art. 12, §9º; Anexo I, item 5, V: a "conformidade" é derivada objetivamente
 * da aderência ao RTO e ao RPO aferidos no teste — não é um campo de livre
 * escolha do usuário, para impedir autodeclaração otimista.
 */
function calcularConformidade(input: {
  rtoAferido: number
  rtoDefinido: number
  rpoAferido: number
  rpoDefinido: number
}): 'INTEGRAL' | 'PARCIAL' | 'NAO_CONFORME' {
  const rtoOk = input.rtoAferido <= input.rtoDefinido
  const rpoOk = input.rpoAferido <= input.rpoDefinido
  if (rtoOk && rpoOk) return 'INTEGRAL'
  if (rtoOk || rpoOk) return 'PARCIAL'
  return 'NAO_CONFORME'
}

export async function criarTesteRestauracao(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await garantirPodeEditar(userId, serventiaId)
  if (!membro) return { error: 'Sem permissão para registrar testes de restauração' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = testeSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos: ' + parsed.error.issues.map((i) => i.message).join('; ') }

  const conformidade = calcularConformidade(parsed.data)

  const result = await runLogged('criarTesteRestauracao', { userId, serventiaId }, async () => {
    const teste = await db.testeRestauracao.create({
      data: {
        serventiaId,
        dataTeste: parsed.data.dataTeste,
        sistemasRestaurados: parsed.data.sistemasRestaurados,
        rtoDefinido: parsed.data.rtoDefinido,
        rtoAferido: parsed.data.rtoAferido,
        rpoDefinido: parsed.data.rpoDefinido,
        rpoAferido: parsed.data.rpoAferido,
        conformidade,
        participantes: parsed.data.participantes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arquiteturaBackup: parsed.data.arquiteturaBackup as any,
      },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: 'TESTE_RESTAURACAO_CRIADO',
      entidade: 'TesteRestauracao',
      entidadeId: teste.id,
      valorNovo: { dataTeste: teste.dataTeste, conformidade: teste.conformidade },
    })

    return teste
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/testes-restauracao')
  return { success: true, id: result.value.id }
}

/** Anexo V, item 8 — registro das providências deliberadas para o plano corretivo */
export async function atualizarMedidasCorretivas(
  serventiaId: string,
  testeId: string,
  medidasCorretivas: string,
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await garantirPodeEditar(userId, serventiaId)
  if (!membro) return { error: 'Sem permissão para editar testes de restauração' }

  const teste = await db.testeRestauracao.findFirst({ where: { id: testeId, serventiaId } })
  if (!teste) return { error: 'Teste de restauração não encontrado' }

  const result = await runLogged('atualizarMedidasCorretivas', { userId, serventiaId, testeId }, async () => {
    await db.testeRestauracao.update({
      where: { id: testeId },
      data: { medidasCorretivas },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: 'TESTE_RESTAURACAO_CRIADO', // reutiliza ação do módulo; valorNovo distingue a operação
      entidade: 'TesteRestauracao',
      entidadeId: testeId,
      valorNovo: { operacao: 'MEDIDAS_CORRETIVAS_ATUALIZADAS', medidasCorretivas },
    })
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/testes-restauracao')
  return { success: true }
}
