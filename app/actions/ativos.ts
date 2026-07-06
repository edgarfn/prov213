'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'
import { runLogged } from '@/lib/logger'

const TIPOS = [
  'EQUIPAMENTO', 'SISTEMA_SOFTWARE', 'BANCO_DADOS',
  'INTEGRACAO', 'CERTIFICADO_DIGITAL', 'CONTRATO_FORNECEDOR', 'OUTRO',
] as const
const CRITICIDADES = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] as const
const STATUS_ATIVO = ['EM_AQUISICAO', 'ATIVO', 'EM_MANUTENCAO', 'DESCONTINUADO', 'BAIXADO'] as const

const optionalText = z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined))
const optionalId = z.string().optional().transform((s) => (s?.trim() && s !== '_none' ? s.trim() : undefined))
const clearableId = z.string().optional().transform((s) => (s?.trim() && s !== '_none' ? s.trim() : null))
const optionalDate = z.string().optional().transform((s) => (s?.trim() ? new Date(s) : undefined))
// NUNCA usar z.coerce.boolean() aqui — ver comentário em app/actions/vulnerabilidades.ts
// (o cliente envia a string "false", e Boolean("false") é true em JS).
const boolFromString = z.string().optional().transform((s) => s === 'true')

const ativoSchema = z.object({
  nome: z.string().min(2),
  tipo: z.enum(TIPOS),
  criticidade: z.enum(CRITICIDADES),
  status: z.enum(STATUS_ATIVO).optional().default('ATIVO'),
  fabricante: optionalText,
  modelo: optionalText,
  numeroSerie: optionalText,
  identificadorRede: optionalText,
  localizacao: optionalText,
  fornecedor: optionalText,
  descricao: optionalText,
  contemDadosPessoais: boolFromString,
  versaoAtual: optionalText,
  dataUltimaAtualizacao: optionalDate,
  dataAquisicao: optionalDate,
  dataEntradaProducao: optionalDate,
  dataFimVidaUtil: optionalDate,
  responsavelId: optionalId,
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

export async function criarAtivo(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await garantirPodeEditar(userId, serventiaId)
  if (!membro) return { error: 'Sem permissão para cadastrar ativos' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = ativoSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos.' }

  if (!(await validarResponsavel(parsed.data.responsavelId, serventiaId))) {
    return { error: 'Responsável selecionado não pertence a esta serventia.' }
  }

  if (parsed.data.status === 'BAIXADO') {
    return { error: 'Um ativo não pode ser cadastrado já baixado — registre-o e depois dê baixa.' }
  }

  const result = await runLogged('criarAtivo', { userId, serventiaId }, async () => {
    const ativo = await db.ativo.create({
      data: { serventiaId, ...parsed.data },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: 'ATIVO_CRIADO',
      entidade: 'Ativo',
      entidadeId: ativo.id,
      valorNovo: { nome: ativo.nome, tipo: ativo.tipo, criticidade: ativo.criticidade },
    })

    return ativo
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/ativos')
  return { success: true, id: result.value.id }
}

const atualizacaoSchema = z.object({
  nome: z.string().min(2).optional(),
  tipo: z.enum(TIPOS).optional(),
  criticidade: z.enum(CRITICIDADES).optional(),
  status: z.enum(STATUS_ATIVO).optional(),
  fabricante: optionalText,
  modelo: optionalText,
  numeroSerie: optionalText,
  identificadorRede: optionalText,
  localizacao: optionalText,
  fornecedor: optionalText,
  descricao: optionalText,
  contemDadosPessoais: boolFromString,
  versaoAtual: optionalText,
  dataUltimaAtualizacao: optionalDate,
  dataAquisicao: optionalDate,
  dataEntradaProducao: optionalDate,
  dataFimVidaUtil: optionalDate,
  responsavelId: clearableId,
  justificativaBaixa: z.string().optional(),
})

export async function atualizarAtivo(serventiaId: string, ativoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  const membro = await garantirPodeEditar(userId, serventiaId)
  if (!membro) return { error: 'Sem permissão' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = atualizacaoSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Dados inválidos' }

  const anterior = await db.ativo.findFirst({ where: { id: ativoId, serventiaId } })
  if (!anterior) return { error: 'Ativo não encontrado' }

  if (!(await validarResponsavel(parsed.data.responsavelId, serventiaId))) {
    return { error: 'Responsável selecionado não pertence a esta serventia.' }
  }

  const novoStatus = parsed.data.status ?? anterior.status
  const indoParaBaixado = novoStatus === 'BAIXADO' && anterior.status !== 'BAIXADO'

  // Baixa é uma decisão de ciclo de vida (descarte/fim de contrato) — exige
  // justificativa registrada, no mesmo espírito do encerramento formal de
  // vulnerabilidades e incidentes.
  if (indoParaBaixado && !(parsed.data.justificativaBaixa ?? anterior.justificativaBaixa)?.trim()) {
    return { error: 'Registre a justificativa da baixa antes de encerrar o ciclo de vida deste ativo.' }
  }

  const result = await runLogged('atualizarAtivo', { userId, serventiaId, ativoId }, async () => {
    const ativo = await db.ativo.update({
      where: { id: ativoId },
      data: {
        nome: parsed.data.nome ?? anterior.nome,
        tipo: parsed.data.tipo ?? anterior.tipo,
        criticidade: parsed.data.criticidade ?? anterior.criticidade,
        status: novoStatus,
        fabricante: parsed.data.fabricante ?? anterior.fabricante,
        modelo: parsed.data.modelo ?? anterior.modelo,
        numeroSerie: parsed.data.numeroSerie ?? anterior.numeroSerie,
        identificadorRede: parsed.data.identificadorRede ?? anterior.identificadorRede,
        localizacao: parsed.data.localizacao ?? anterior.localizacao,
        fornecedor: parsed.data.fornecedor ?? anterior.fornecedor,
        descricao: parsed.data.descricao ?? anterior.descricao,
        contemDadosPessoais: parsed.data.contemDadosPessoais ?? anterior.contemDadosPessoais,
        versaoAtual: parsed.data.versaoAtual ?? anterior.versaoAtual,
        dataUltimaAtualizacao: parsed.data.dataUltimaAtualizacao ?? anterior.dataUltimaAtualizacao,
        dataAquisicao: parsed.data.dataAquisicao ?? anterior.dataAquisicao,
        dataEntradaProducao: parsed.data.dataEntradaProducao ?? anterior.dataEntradaProducao,
        dataFimVidaUtil: parsed.data.dataFimVidaUtil ?? anterior.dataFimVidaUtil,
        responsavelId: parsed.data.responsavelId !== undefined ? parsed.data.responsavelId : anterior.responsavelId,
        justificativaBaixa: parsed.data.justificativaBaixa ?? anterior.justificativaBaixa,
        dataBaixa: indoParaBaixado ? new Date() : anterior.dataBaixa,
      },
    })

    await logAudit({
      serventiaId,
      userId,
      acao: indoParaBaixado ? 'ATIVO_BAIXADO' : 'ATIVO_ATUALIZADO',
      entidade: 'Ativo',
      entidadeId: ativo.id,
      valorAnterior: { status: anterior.status },
      valorNovo: { status: ativo.status },
    })
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/ativos')
  revalidatePath('/vulnerabilidades')
  return { success: true }
}
