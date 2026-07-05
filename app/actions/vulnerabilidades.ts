'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'
import { prazoVulnerabilidade } from '@/lib/business-rules'

const CLASSIFICACOES = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] as const
const ORIGENS = [
  'PENTESTE', 'SCANNER_AUTOMATIZADO', 'REPORTE_INTERNO',
  'REPORTE_EXTERNO', 'AUDITORIA', 'FORNECEDOR_CVE', 'OUTRO',
] as const
const STATUS_TERMINAIS = ['CORRIGIDA', 'RISCO_ACEITO', 'FALSO_POSITIVO'] as const

const optionalText = z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined))
const optionalId = z.string().optional().transform((s) => (s?.trim() && s !== '_none' ? s.trim() : undefined))
const clearableId = z.string().optional().transform((s) => (s?.trim() && s !== '_none' ? s.trim() : null))
const boolFromString = z.string().optional().transform((s) => (s === undefined ? undefined : s === 'true'))
const optionalCvss = z.string().optional().transform((s) => {
  if (!s?.trim()) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : undefined
})

const vulnerabilidadeSchema = z.object({
  descricao: z.string().min(3),
  dataIdentificacao: z.string().transform((s) => new Date(s)),
  classificacaoRisco: z.enum(CLASSIFICACOES),
  origem: z.enum(ORIGENS).optional().default('OUTRO'),
  ativoAfetado: optionalText,
  cveReferencia: optionalText,
  cvssScore: optionalCvss,
  responsavelId: optionalId,
  // NUNCA usar z.coerce.boolean() aqui: o cliente envia a string "false" (via
  // String(booleano) no FormData), e Boolean("false") é true em JS — todo
  // registro seria criado com exploracaoAtiva=true, encurtando o prazo para
  // 72h independente do que o usuário marcou (bug real já existente nesta
  // tela antes desta revisão).
  exploracaoAtiva: z.string().optional().transform((s) => s === 'true'),
})

async function garantirPodeEditar(userId: string, serventiaId: string) {
  const membro = await requireServentiaMembro(userId, serventiaId)
  if (!membro || membro.papel === 'AUDITOR_LEITURA') return null
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

  if (!(await validarResponsavel(parsed.data.responsavelId, serventiaId))) {
    return { error: 'Responsável selecionado não pertence a esta serventia.' }
  }

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
  status: z.enum(['IDENTIFICADA', 'EM_CORRECAO', 'CORRIGIDA', 'RISCO_ACEITO', 'FALSO_POSITIVO'] as const).optional(),
  classificacaoRisco: z.enum(CLASSIFICACOES).optional(),
  origem: z.enum(ORIGENS).optional(),
  ativoAfetado: optionalText,
  cveReferencia: optionalText,
  cvssScore: optionalCvss,
  responsavelId: clearableId,
  exploracaoAtiva: boolFromString,
  providencias: z.string().optional(),
  justificativaRiscoAceito: z.string().optional(),
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

  if (!(await validarResponsavel(parsed.data.responsavelId, serventiaId))) {
    return { error: 'Responsável selecionado não pertence a esta serventia.' }
  }

  const novoStatus = parsed.data.status ?? anterior.status
  const indoParaTerminal = STATUS_TERMINAIS.includes(novoStatus as (typeof STATUS_TERMINAIS)[number])

  // Art. 11, §4º: providências devem estar registradas para encerramento formal.
  if (indoParaTerminal && !(parsed.data.providencias ?? anterior.providencias)?.trim()) {
    return { error: 'Registre as providências adotadas antes de encerrar (Art. 11, §4º).' }
  }

  // Aceite formal de risco exige justificativa própria, distinta das providências
  // (é uma decisão de não corrigir, não uma correção — precisa de registro específico).
  if (novoStatus === 'RISCO_ACEITO' && !(parsed.data.justificativaRiscoAceito ?? anterior.justificativaRiscoAceito)?.trim()) {
    return { error: 'Registre a justificativa do aceite de risco antes de encerrar com este status.' }
  }

  const exploracaoAtiva = parsed.data.exploracaoAtiva ?? anterior.exploracaoAtiva
  const prazoLimite =
    exploracaoAtiva !== anterior.exploracaoAtiva
      ? prazoVulnerabilidade(anterior.dataIdentificacao, exploracaoAtiva)
      : anterior.prazoLimite

  const vulnerabilidade = await db.vulnerabilidade.update({
    where: { id: vulnerabilidadeId },
    data: {
      status: novoStatus,
      classificacaoRisco: parsed.data.classificacaoRisco ?? anterior.classificacaoRisco,
      origem: parsed.data.origem ?? anterior.origem,
      ativoAfetado: parsed.data.ativoAfetado ?? anterior.ativoAfetado,
      cveReferencia: parsed.data.cveReferencia ?? anterior.cveReferencia,
      cvssScore: parsed.data.cvssScore ?? anterior.cvssScore,
      responsavelId: parsed.data.responsavelId !== undefined ? parsed.data.responsavelId : anterior.responsavelId,
      exploracaoAtiva,
      prazoLimite,
      providencias: parsed.data.providencias ?? anterior.providencias,
      justificativaRiscoAceito: parsed.data.justificativaRiscoAceito ?? anterior.justificativaRiscoAceito,
      dataEncerramento: indoParaTerminal ? (anterior.dataEncerramento ?? new Date()) : null,
    },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: indoParaTerminal ? 'VULNERABILIDADE_ENCERRADA' : 'VULNERABILIDADE_ATUALIZADA',
    entidade: 'Vulnerabilidade',
    entidadeId: vulnerabilidade.id,
    valorAnterior: { status: anterior.status, exploracaoAtiva: anterior.exploracaoAtiva },
    valorNovo: { status: vulnerabilidade.status, exploracaoAtiva: vulnerabilidade.exploracaoAtiva },
  })

  revalidatePath('/vulnerabilidades')
  return { success: true }
}
