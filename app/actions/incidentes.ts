'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'
import { runLogged, getLogger } from '@/lib/logger'
import { optionalText, optionalId, clearableId, boolFromString, optionalInt } from '@/lib/zod-form-helpers'

const CATEGORIAS = [
  'ACESSO_NAO_AUTORIZADO', 'MALWARE_RANSOMWARE', 'VAZAMENTO_DADOS',
  'INDISPONIBILIDADE_DOS', 'PHISHING_ENGENHARIA_SOCIAL', 'FALHA_CONFIGURACAO',
  'PERDA_ROUBO_DISPOSITIVO', 'FISICO', 'OUTRO',
] as const

const incidenteSchema = z.object({
  titulo: z.string().min(3),
  descricao: z.string().min(3),
  categoria: z.enum(CATEGORIAS).optional().default('OUTRO'),
  dataOcorrencia: z.string().transform((s) => new Date(s)),
  dataCiencia: z.string().transform((s) => new Date(s)),
  gravidade: z.enum(['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] as const),
  responsavelId: optionalId,
  dadosPessoaisEnvolvidos: boolFromString,
  categoriasDadosAfetados: optionalText,
  quantidadeTitularesAfetados: optionalInt,
  riscosTitulares: optionalText,
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

/** Garante que o responsável atribuído é de fato membro ativo desta serventia. */
async function validarResponsavel(responsavelId: string | null | undefined, serventiaId: string) {
  if (!responsavelId) return true
  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId: responsavelId, serventiaId } },
  })
  return !!membro?.ativo
}

export async function criarIncidente(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão para registrar incidentes' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = incidenteSchema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    if (!(await validarResponsavel(parsed.data.responsavelId, serventiaId))) {
      return { error: 'Responsável selecionado não pertence a esta serventia.' }
    }

    const result = await runLogged('criarIncidente', { userId, serventiaId }, async () => {
      const incidente = await db.incidente.create({
        data: { serventiaId, ...parsed.data },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'INCIDENTE_CRIADO',
        entidade: 'Incidente',
        entidadeId: incidente.id,
        valorNovo: { titulo: incidente.titulo, gravidade: incidente.gravidade },
      })

      return incidente
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/incidentes')
    return { success: true, id: result.value.id }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, action: 'criarIncidente' })
    log.error({ err }, 'Falha inesperada ao criar incidente')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

const atualizacaoSchema = z.object({
  status: z.enum(['ABERTO', 'EM_TRATAMENTO', 'ENCERRADO'] as const).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  causaRaiz: z.string().optional(),
  medidasCorretivas: z.string().optional(),
  responsavelId: clearableId,
  dadosPessoaisEnvolvidos: boolFromString,
  categoriasDadosAfetados: optionalText,
  quantidadeTitularesAfetados: optionalInt,
  riscosTitulares: optionalText,
})

export async function atualizarIncidente(serventiaId: string, incidenteId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = atualizacaoSchema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos' }

    const anterior = await db.incidente.findFirst({ where: { id: incidenteId, serventiaId } })
    if (!anterior) return { error: 'Incidente não encontrado' }

    if (!(await validarResponsavel(parsed.data.responsavelId, serventiaId))) {
      return { error: 'Responsável selecionado não pertence a esta serventia.' }
    }

    // Art. 11, §2º: análise de causa raiz e medidas corretivas são exigidas
    // para o encerramento — não se permite fechar um incidente sem elas.
    if (parsed.data.status === 'ENCERRADO') {
      const causaRaiz = parsed.data.causaRaiz ?? anterior.causaRaiz
      const medidas = parsed.data.medidasCorretivas ?? anterior.medidasCorretivas
      if (!causaRaiz?.trim() || !medidas?.trim()) {
        return { error: 'Para encerrar, registre a análise de causa raiz e as medidas corretivas (Art. 11, §2º).' }
      }
    }

    const result = await runLogged('atualizarIncidente', { userId, serventiaId, incidenteId }, async () => {
      const incidente = await db.incidente.update({
        where: { id: incidenteId },
        data: parsed.data,
      })

      await logAudit({
        serventiaId,
        userId,
        acao: incidente.status === 'ENCERRADO' ? 'INCIDENTE_ENCERRADO' : 'INCIDENTE_ATUALIZADO',
        entidade: 'Incidente',
        entidadeId: incidente.id,
        valorAnterior: { status: anterior.status },
        valorNovo: { status: incidente.status },
      })
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/incidentes')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, incidenteId, action: 'atualizarIncidente' })
    log.error({ err }, 'Falha inesperada ao atualizar incidente')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

/**
 * Art. 11, §1º: comunicação do incidente crítico à Corregedoria em até 72h.
 * Registra a data efetiva da comunicação para o cálculo de aderência ao prazo.
 */
export async function comunicarCorregedoria(serventiaId: string, incidenteId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const result = await runLogged('comunicarCorregedoria', { userId, serventiaId, incidenteId }, async () => {
      const incidente = await db.incidente.update({
        where: { id: incidenteId },
        data: { comunicadoCorregedoria: true, dataComunicacao: new Date() },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'INCIDENTE_COMUNICADO_CORREGEDORIA',
        entidade: 'Incidente',
        entidadeId: incidente.id,
        valorNovo: { dataComunicacao: incidente.dataComunicacao },
      })
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/incidentes')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, incidenteId, action: 'comunicarCorregedoria' })
    log.error({ err }, 'Falha inesperada ao comunicar incidente à Corregedoria')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

/** Art. 7º, §3º; Anexo II, item 4, V: incidentes com dados pessoais também vão à ANPD. */
export async function comunicarAnpd(serventiaId: string, incidenteId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const result = await runLogged('comunicarAnpd', { userId, serventiaId, incidenteId }, async () => {
      const incidente = await db.incidente.update({
        where: { id: incidenteId },
        data: { comunicadoAnpd: true },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'INCIDENTE_COMUNICADO_ANPD',
        entidade: 'Incidente',
        entidadeId: incidente.id,
      })
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/incidentes')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, incidenteId, action: 'comunicarAnpd' })
    log.error({ err }, 'Falha inesperada ao comunicar incidente à ANPD')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}
