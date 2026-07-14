'use server'

import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireServentiaMembro } from '@/lib/serventia-context'
import { runLogged, getLogger } from '@/lib/logger'
import { optionalText, optionalId } from '@/lib/zod-form-helpers'
import {
  proximoCodigoRecomendacao,
  proximoStatusAposAnaliseRisco,
  proximoStatusAposDecisao,
  proximoStatusAposAceite,
  exigeTermoCiencia,
} from '@/lib/recomendacao-tecnica'

const PRIORIDADES = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] as const
const DECISOES = [
  'APROVADO_INTEGRAL', 'APROVADO_COM_CONDICOES', 'APROVADO_IMPLANTACAO_FUTURA',
  'COMPLEMENTACAO_SOLICITADA', 'REJEITADO', 'RISCO_ACEITO_TEMPORARIO', 'SUBSTITUIDO_EQUIVALENTE',
] as const
const RESULTADOS_ACEITE = ['INTEGRAL', 'PARCIAL', 'NAO_CONFORME'] as const

const optionalDate = z.string().optional().transform((s) => (s?.trim() ? new Date(s) : undefined))
const boolChecked = z.string().optional().transform((s) => s === 'true')

async function garantirPodeEditar(userId: string, serventiaId: string) {
  const membro = await requireServentiaMembro(userId, serventiaId)
  if (!membro || membro.papel === 'AUDITOR_LEITURA') return null
  return membro
}

/** Garante que o usuário indicado é membro ativo desta serventia (isolamento multi-tenant). */
async function validarMembroAtivo(userId: string | undefined, serventiaId: string, papelExigido?: 'TITULAR') {
  if (!userId) return true
  const membro = await db.membroServentia.findUnique({ where: { userId_serventiaId: { userId, serventiaId } } })
  if (!membro?.ativo) return false
  if (papelExigido && membro.papel !== papelExigido) return false
  return true
}

// ─── Etapa 1 — Recomendação Técnica (GOV-TI-01) ──────────────────────────────

const etapa1Schema = z.object({
  dataIdentificacao: z.string().transform((s) => new Date(s)),
  prazoRecomendado: optionalDate,
  prioridade: z.enum(PRIORIDADES),
  responsavelTecnicoId: z.string().min(1),
  situacaoAtual: z.string().min(3),
  problemaDeficiencia: z.string().min(3),
  requisitoRelacionado: optionalText,
  ativoAfetado: optionalText,
  riscoNaoImplementar: z.string().min(3),
  solucaoRecomendada: z.string().min(3),
  alternativasPossiveis: optionalText,
  estimativaCusto: optionalText,
  evidenciasColetadasObs: optionalText,
})

export async function criarRecomendacao(serventiaId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão para registrar recomendações técnicas' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa1Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    if (!(await validarMembroAtivo(parsed.data.responsavelTecnicoId, serventiaId))) {
      return { error: 'Responsável técnico selecionado não pertence a esta serventia.' }
    }

    const result = await runLogged('criarRecomendacao', { userId, serventiaId }, async () => {
      const serventia = await db.serventia.findUniqueOrThrow({ where: { id: serventiaId }, select: { cns: true } })
      const ano = new Date().getFullYear()

      const recomendacao = await db.$transaction(async (tx) => {
        const { codigo, sequencial } = await proximoCodigoRecomendacao(tx, serventiaId, serventia.cns, ano)
        return tx.recomendacaoTecnica.create({
          data: {
            serventiaId,
            codigo,
            anoReferencia: ano,
            sequencial,
            prioridade: parsed.data.prioridade,
            dataIdentificacao: parsed.data.dataIdentificacao,
            prazoRecomendado: parsed.data.prazoRecomendado,
            responsavelTecnicoId: parsed.data.responsavelTecnicoId,
            recomendacao: {
              situacaoAtual: parsed.data.situacaoAtual,
              problemaDeficiencia: parsed.data.problemaDeficiencia,
              requisitoRelacionado: parsed.data.requisitoRelacionado ?? null,
              ativoAfetado: parsed.data.ativoAfetado ?? null,
              riscoNaoImplementar: parsed.data.riscoNaoImplementar,
              solucaoRecomendada: parsed.data.solucaoRecomendada,
              alternativasPossiveis: parsed.data.alternativasPossiveis ?? null,
              estimativaCusto: parsed.data.estimativaCusto ?? null,
              evidenciasColetadasObs: parsed.data.evidenciasColetadasObs ?? null,
            },
          },
        })
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_CRIADA',
        entidade: 'RecomendacaoTecnica',
        entidadeId: recomendacao.id,
        valorNovo: { codigo: recomendacao.codigo, prioridade: recomendacao.prioridade },
      })

      return recomendacao
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true, id: result.value.id, codigo: result.value.codigo }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, action: 'criarRecomendacao' })
    log.error({ err }, 'Falha inesperada ao criar recomendação técnica')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

// ─── Etapa 2 — Análise de Risco e Conformidade (GOV-TI-02) ───────────────────

const etapa2Schema = z.object({
  classificacaoRiscoFinal: z.enum(PRIORIDADES),
  envolveDadosPessoais: boolChecked,
  probabilidadeOcorrencia: z.string().min(3),
  impactoOperacional: z.string().min(3),
  impactoDadosPessoais: optionalText,
  impactoAcervoRegistral: z.string().min(3),
  impactoFinanceiro: optionalText,
  impactoJuridicoCorrecional: optionalText,
  controlesExistentes: optionalText,
  controlesRecomendados: z.string().min(3),
  riscoResidualAposImplementacao: z.string().min(3),
  consequenciaRejeicao: z.string().min(3),
  relacaoPcnPrd: optionalText,
  relacaoRpoRto: optionalText,
})

export async function registrarAnaliseRisco(serventiaId: string, recomendacaoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa2Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const anterior = await db.recomendacaoTecnica.findFirst({ where: { id: recomendacaoId, serventiaId } })
    if (!anterior) return { error: 'Recomendação não encontrada' }
    if (anterior.status !== 'RASCUNHO' && anterior.status !== 'COMPLEMENTACAO_SOLICITADA') {
      return { error: 'Esta recomendação não está numa etapa que permita registrar a análise de risco.' }
    }

    const novoStatus = proximoStatusAposAnaliseRisco(parsed.data.envolveDadosPessoais)

    const result = await runLogged('registrarAnaliseRisco', { userId, serventiaId, recomendacaoId }, async () => {
      const atualizado = await db.recomendacaoTecnica.update({
        where: { id: recomendacaoId },
        data: {
          classificacaoRiscoFinal: parsed.data.classificacaoRiscoFinal,
          envolveDadosPessoais: parsed.data.envolveDadosPessoais,
          status: novoStatus,
          analiseRisco: {
            probabilidadeOcorrencia: parsed.data.probabilidadeOcorrencia,
            impactoOperacional: parsed.data.impactoOperacional,
            impactoDadosPessoais: parsed.data.impactoDadosPessoais ?? null,
            impactoAcervoRegistral: parsed.data.impactoAcervoRegistral,
            impactoFinanceiro: parsed.data.impactoFinanceiro ?? null,
            impactoJuridicoCorrecional: parsed.data.impactoJuridicoCorrecional ?? null,
            controlesExistentes: parsed.data.controlesExistentes ?? null,
            controlesRecomendados: parsed.data.controlesRecomendados,
            riscoResidualAposImplementacao: parsed.data.riscoResidualAposImplementacao,
            consequenciaRejeicao: parsed.data.consequenciaRejeicao,
            relacaoPcnPrd: parsed.data.relacaoPcnPrd ?? null,
            relacaoRpoRto: parsed.data.relacaoRpoRto ?? null,
          },
        },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_ANALISE_RISCO_REGISTRADA',
        entidade: 'RecomendacaoTecnica',
        entidadeId: atualizado.id,
        valorNovo: { classificacaoRiscoFinal: atualizado.classificacaoRiscoFinal, envolveDadosPessoais: atualizado.envolveDadosPessoais, status: atualizado.status },
      })

      return atualizado
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, recomendacaoId, action: 'registrarAnaliseRisco' })
    log.error({ err }, 'Falha inesperada ao registrar análise de risco')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

// ─── Etapa 3 — Parecer de Privacidade e Proteção de Dados (GOV-TI-03) ────────

const etapa3Schema = z.object({
  necessidadeProporcionalidade: z.string().min(3),
  dadosSensiveisEnvolvidos: optionalText,
  novosFornecedores: optionalText,
  acessosRemotos: optionalText,
  armazenamentoNuvem: optionalText,
  transferenciaInternacional: optionalText,
  logsMonitoramento: optionalText,
  retencao: optionalText,
  contratosOperadores: optionalText,
  riscoTitulares: z.string().min(3),
  necessidadeRipd: boolChecked,
  necessidadeAtualizarRopa: boolChecked,
  conclusao: z.string().min(3),
})

export async function registrarParecerDpo(serventiaId: string, recomendacaoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await requireServentiaMembro(userId, serventiaId)
    if (!membro || membro.papel !== 'DPO') {
      return { error: 'Apenas um membro com papel DPO pode registrar o parecer de privacidade.' }
    }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa3Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const anterior = await db.recomendacaoTecnica.findFirst({ where: { id: recomendacaoId, serventiaId } })
    if (!anterior) return { error: 'Recomendação não encontrada' }
    if (anterior.status !== 'AGUARDANDO_PARECER_DPO') {
      return { error: 'Esta recomendação não está aguardando parecer do DPO.' }
    }

    const result = await runLogged('registrarParecerDpo', { userId, serventiaId, recomendacaoId }, async () => {
      const atualizado = await db.recomendacaoTecnica.update({
        where: { id: recomendacaoId },
        data: {
          parecerDpoUserId: userId,
          parecerDpoConcluidoEm: new Date(),
          status: 'AGUARDANDO_DECISAO',
          parecerDpo: {
            necessidadeProporcionalidade: parsed.data.necessidadeProporcionalidade,
            dadosSensiveisEnvolvidos: parsed.data.dadosSensiveisEnvolvidos ?? null,
            novosFornecedores: parsed.data.novosFornecedores ?? null,
            acessosRemotos: parsed.data.acessosRemotos ?? null,
            armazenamentoNuvem: parsed.data.armazenamentoNuvem ?? null,
            transferenciaInternacional: parsed.data.transferenciaInternacional ?? null,
            logsMonitoramento: parsed.data.logsMonitoramento ?? null,
            retencao: parsed.data.retencao ?? null,
            contratosOperadores: parsed.data.contratosOperadores ?? null,
            riscoTitulares: parsed.data.riscoTitulares,
            necessidadeRipd: parsed.data.necessidadeRipd,
            necessidadeAtualizarRopa: parsed.data.necessidadeAtualizarRopa,
            conclusao: parsed.data.conclusao,
          },
        },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_PARECER_DPO_REGISTRADO',
        entidade: 'RecomendacaoTecnica',
        entidadeId: atualizado.id,
        valorNovo: { necessidadeRipd: parsed.data.necessidadeRipd, necessidadeAtualizarRopa: parsed.data.necessidadeAtualizarRopa },
      })

      return atualizado
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, recomendacaoId, action: 'registrarParecerDpo' })
    log.error({ err }, 'Falha inesperada ao registrar parecer do DPO')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

// ─── Etapa 4 — Decisão formal do Controlador (GOV-TI-04 + GOV-TI-09) ─────────

const etapa4Schema = z.object({
  decisao: z.enum(DECISOES),
  valorAutorizado: z.string().optional().transform((s) => {
    if (!s?.trim()) return undefined
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
  }),
  prazoImplantacao: optionalDate,
  responsavelExecucaoId: optionalId,
  fonteOrcamentaria: optionalText,
  condicoesImpostas: optionalText,
  riscoResidualConhecido: optionalText,
  // Termo de Ciência, Recusa e Aceitação Temporária de Risco (GOV-TI-09) —
  // exigido só quando decisao IN (REJEITADO, RISCO_ACEITO_TEMPORARIO)
  prazoReavaliacao: optionalDate,
  fundamentoTecnico: optionalText,
  consequenciasRejeicao: optionalText,
  alternativasApresentadas: optionalText,
  motivoDeclarado: optionalText,
  medidasCompensatorias: optionalText,
})

export async function decidirRecomendacao(serventiaId: string, recomendacaoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await requireServentiaMembro(userId, serventiaId)
    if (!membro || membro.papel !== 'TITULAR') {
      return { error: 'Apenas o Titular (Controlador de Dados) pode registrar esta decisão.' }
    }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa4Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const anterior = await db.recomendacaoTecnica.findFirst({ where: { id: recomendacaoId, serventiaId } })
    if (!anterior) return { error: 'Recomendação não encontrada' }
    if (anterior.status !== 'AGUARDANDO_DECISAO') {
      return { error: 'Esta recomendação não está aguardando decisão.' }
    }

    const precisaTermoCiencia = exigeTermoCiencia(parsed.data.decisao)
    if (precisaTermoCiencia) {
      if (!parsed.data.fundamentoTecnico || !parsed.data.consequenciasRejeicao || !parsed.data.motivoDeclarado) {
        return {
          error:
            'Preencha o Termo de Ciência, Recusa e Aceitação Temporária de Risco (fundamento técnico, consequências e motivo declarado) antes de registrar esta decisão.',
        }
      }
      if (parsed.data.decisao === 'RISCO_ACEITO_TEMPORARIO' && !parsed.data.prazoReavaliacao) {
        return { error: 'Informe o prazo de reavaliação para o risco aceito temporariamente.' }
      }
    }

    if (!(await validarMembroAtivo(parsed.data.responsavelExecucaoId, serventiaId))) {
      return { error: 'Responsável pela execução selecionado não pertence a esta serventia.' }
    }

    const novoStatus = proximoStatusAposDecisao(parsed.data.decisao)

    const result = await runLogged('decidirRecomendacao', { userId, serventiaId, recomendacaoId }, async () => {
      const atualizado = await db.recomendacaoTecnica.update({
        where: { id: recomendacaoId },
        data: {
          decisao: parsed.data.decisao,
          decisaoControladorUserId: userId,
          dataDecisao: new Date(),
          valorAutorizado: parsed.data.valorAutorizado,
          prazoImplantacao: parsed.data.prazoImplantacao,
          responsavelExecucaoId: parsed.data.responsavelExecucaoId,
          status: novoStatus,
          decisaoDetalhes: {
            fonteOrcamentaria: parsed.data.fonteOrcamentaria ?? null,
            condicoesImpostas: parsed.data.condicoesImpostas ?? null,
            riscoResidualConhecido: parsed.data.riscoResidualConhecido ?? null,
          },
          ...(precisaTermoCiencia
            ? {
                prazoReavaliacao: parsed.data.prazoReavaliacao,
                termoCiencia: {
                  fundamentoTecnico: parsed.data.fundamentoTecnico,
                  consequenciasRejeicao: parsed.data.consequenciasRejeicao,
                  alternativasApresentadas: parsed.data.alternativasApresentadas ?? null,
                  motivoDeclarado: parsed.data.motivoDeclarado,
                  medidasCompensatorias: parsed.data.medidasCompensatorias ?? null,
                },
              }
            : {}),
        },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_DECIDIDA',
        entidade: 'RecomendacaoTecnica',
        entidadeId: atualizado.id,
        valorNovo: { decisao: atualizado.decisao, status: atualizado.status },
      })

      return atualizado
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, recomendacaoId, action: 'decidirRecomendacao' })
    log.error({ err }, 'Falha inesperada ao decidir recomendação técnica')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

// ─── Etapa 5 — Ordem de Implementação/Mudança (GOV-TI-05) ────────────────────

const etapa5Schema = z.object({
  dataExecucaoPlanejada: optionalDate,
  escopoAprovado: z.string().min(3),
  equipamentosServicos: optionalText,
  responsaveis: optionalText,
  planoRollback: z.string().min(3),
  riscosMudanca: optionalText,
  backupAnterior: optionalText,
  criteriosSucesso: z.string().min(3),
  testesObrigatorios: optionalText,
  indisponibilidadePrevista: optionalText,
  comunicacaoColaboradores: optionalText,
  autorizacaoAcessoPrivilegiado: optionalText,
})

export async function emitirOrdemImplementacao(serventiaId: string, recomendacaoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa5Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const anterior = await db.recomendacaoTecnica.findFirst({ where: { id: recomendacaoId, serventiaId } })
    if (!anterior) return { error: 'Recomendação não encontrada' }
    if (anterior.status !== 'APROVADO_AGUARDANDO_IMPLEMENTACAO') {
      return { error: 'Esta recomendação não está aprovada e aguardando emissão da ordem de implementação.' }
    }

    const result = await runLogged('emitirOrdemImplementacao', { userId, serventiaId, recomendacaoId }, async () => {
      const atualizado = await db.recomendacaoTecnica.update({
        where: { id: recomendacaoId },
        data: {
          ordemEmitidaPorUserId: userId,
          ordemEmitidaEm: new Date(),
          dataExecucaoPlanejada: parsed.data.dataExecucaoPlanejada,
          status: 'EM_IMPLEMENTACAO',
          ordemImplementacao: {
            escopoAprovado: parsed.data.escopoAprovado,
            equipamentosServicos: parsed.data.equipamentosServicos ?? null,
            responsaveis: parsed.data.responsaveis ?? null,
            planoRollback: parsed.data.planoRollback,
            riscosMudanca: parsed.data.riscosMudanca ?? null,
            backupAnterior: parsed.data.backupAnterior ?? null,
            criteriosSucesso: parsed.data.criteriosSucesso,
            testesObrigatorios: parsed.data.testesObrigatorios ?? null,
            indisponibilidadePrevista: parsed.data.indisponibilidadePrevista ?? null,
            comunicacaoColaboradores: parsed.data.comunicacaoColaboradores ?? null,
            autorizacaoAcessoPrivilegiado: parsed.data.autorizacaoAcessoPrivilegiado ?? null,
          },
        },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_ORDEM_IMPLEMENTACAO_EMITIDA',
        entidade: 'RecomendacaoTecnica',
        entidadeId: atualizado.id,
        valorNovo: { status: atualizado.status },
      })

      return atualizado
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, recomendacaoId, action: 'emitirOrdemImplementacao' })
    log.error({ err }, 'Falha inesperada ao emitir ordem de implementação')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

// ─── Etapa 6 — Implementação e coleta de evidências (GOV-TI-06) ──────────────

const etapa6Schema = z.object({
  dataExecucaoRealizada: optionalDate,
  relatorioTecnico: z.string().min(3),
  configuracaoAnterior: optionalText,
  configuracaoPosterior: optionalText,
  usuariosExecutores: optionalText,
  resultadosTestes: optionalText,
  falhas: optionalText,
  medidasCorretivas: optionalText,
})

export async function registrarExecucao(serventiaId: string, recomendacaoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa6Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const anterior = await db.recomendacaoTecnica.findFirst({ where: { id: recomendacaoId, serventiaId } })
    if (!anterior) return { error: 'Recomendação não encontrada' }
    if (anterior.status !== 'EM_IMPLEMENTACAO') {
      return { error: 'Esta recomendação não está em implementação.' }
    }

    const result = await runLogged('registrarExecucao', { userId, serventiaId, recomendacaoId }, async () => {
      const atualizado = await db.recomendacaoTecnica.update({
        where: { id: recomendacaoId },
        data: {
          dataExecucaoRealizada: parsed.data.dataExecucaoRealizada ?? new Date(),
          status: 'AGUARDANDO_ACEITE',
          execucao: {
            relatorioTecnico: parsed.data.relatorioTecnico,
            configuracaoAnterior: parsed.data.configuracaoAnterior ?? null,
            configuracaoPosterior: parsed.data.configuracaoPosterior ?? null,
            usuariosExecutores: parsed.data.usuariosExecutores ?? null,
            resultadosTestes: parsed.data.resultadosTestes ?? null,
            falhas: parsed.data.falhas ?? null,
            medidasCorretivas: parsed.data.medidasCorretivas ?? null,
          },
        },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_EXECUCAO_REGISTRADA',
        entidade: 'RecomendacaoTecnica',
        entidadeId: atualizado.id,
        valorNovo: { status: atualizado.status },
      })

      return atualizado
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, recomendacaoId, action: 'registrarExecucao' })
    log.error({ err }, 'Falha inesperada ao registrar execução')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

// ─── Etapa 7 — Teste e Aceite (GOV-TI-07) ────────────────────────────────────

const etapa7Schema = z.object({
  aceiteResultado: z.enum(RESULTADOS_ACEITE),
  aceiteControladorUserId: z.string().min(1),
  requisitoAtendido: z.string().min(3),
  testesRealizados: z.string().min(3),
  resultadoObtido: z.string().min(3),
  pendencias: optionalText,
  riscoResidual: optionalText,
})

export async function registrarAceite(serventiaId: string, recomendacaoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa7Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const anterior = await db.recomendacaoTecnica.findFirst({ where: { id: recomendacaoId, serventiaId } })
    if (!anterior) return { error: 'Recomendação não encontrada' }
    if (anterior.status !== 'AGUARDANDO_ACEITE') {
      return { error: 'Esta recomendação não está aguardando teste e aceite.' }
    }

    if (!(await validarMembroAtivo(parsed.data.aceiteControladorUserId, serventiaId, 'TITULAR'))) {
      return { error: 'O Controlador que assina o aceite precisa ser um membro ativo com papel Titular.' }
    }

    const novoStatus = proximoStatusAposAceite(parsed.data.aceiteResultado)

    const result = await runLogged('registrarAceite', { userId, serventiaId, recomendacaoId }, async () => {
      const atualizado = await db.recomendacaoTecnica.update({
        where: { id: recomendacaoId },
        data: {
          aceiteResultado: parsed.data.aceiteResultado,
          aceiteTecnicoUserId: userId,
          aceiteControladorUserId: parsed.data.aceiteControladorUserId,
          dataAceite: new Date(),
          status: novoStatus,
          aceite: {
            requisitoAtendido: parsed.data.requisitoAtendido,
            testesRealizados: parsed.data.testesRealizados,
            resultadoObtido: parsed.data.resultadoObtido,
            pendencias: parsed.data.pendencias ?? null,
            riscoResidual: parsed.data.riscoResidual ?? null,
          },
        },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_ACEITE_REGISTRADO',
        entidade: 'RecomendacaoTecnica',
        entidadeId: atualizado.id,
        valorNovo: { aceiteResultado: atualizado.aceiteResultado, status: atualizado.status },
      })

      return atualizado
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, recomendacaoId, action: 'registrarAceite' })
    log.error({ err }, 'Falha inesperada ao registrar aceite')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}

// ─── Etapa 8 — Atualização dos documentos de governança (GOV-TI-10) ─────────

const etapa8Schema = z.object({
  inventarioAtivos: boolChecked,
  diagramaRede: boolChecked,
  pcn: boolChecked,
  prd: boolChecked,
  psi: boolChecked,
  ropa: boolChecked,
  matrizRiscos: boolChecked,
  planoBackup: boolChecked,
  dossieTecnico: boolChecked,
  outros: optionalText,
})

export async function registrarAtualizacaoDocumentos(serventiaId: string, recomendacaoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }
  const userId = session.user.id

  try {
    const membro = await garantirPodeEditar(userId, serventiaId)
    if (!membro) return { error: 'Sem permissão' }

    const raw = Object.fromEntries(formData.entries())
    const parsed = etapa8Schema.safeParse(raw)
    if (!parsed.success) return { error: 'Dados inválidos.' }

    const anterior = await db.recomendacaoTecnica.findFirst({ where: { id: recomendacaoId, serventiaId } })
    if (!anterior) return { error: 'Recomendação não encontrada' }
    if (anterior.status !== 'AGUARDANDO_ATUALIZACAO_DOCUMENTOS') {
      return { error: 'Esta recomendação não está aguardando atualização dos documentos de governança.' }
    }

    const result = await runLogged('registrarAtualizacaoDocumentos', { userId, serventiaId, recomendacaoId }, async () => {
      const atualizado = await db.recomendacaoTecnica.update({
        where: { id: recomendacaoId },
        data: {
          documentosAtualizadosEm: new Date(),
          status: 'CONCLUIDO',
          documentosAtualizados: {
            inventarioAtivos: parsed.data.inventarioAtivos,
            diagramaRede: parsed.data.diagramaRede,
            pcn: parsed.data.pcn,
            prd: parsed.data.prd,
            psi: parsed.data.psi,
            ropa: parsed.data.ropa,
            matrizRiscos: parsed.data.matrizRiscos,
            planoBackup: parsed.data.planoBackup,
            dossieTecnico: parsed.data.dossieTecnico,
            outros: parsed.data.outros ?? null,
          },
        },
      })

      await logAudit({
        serventiaId,
        userId,
        acao: 'RECOMENDACAO_DOCUMENTOS_ATUALIZADOS',
        entidade: 'RecomendacaoTecnica',
        entidadeId: atualizado.id,
        valorNovo: { status: atualizado.status },
      })

      return atualizado
    })
    if (!result.ok) return { error: result.error }

    revalidatePath('/recomendacoes-tecnicas')
    return { success: true }
  } catch (err) {
    const log = await getLogger({ userId, serventiaId, recomendacaoId, action: 'registrarAtualizacaoDocumentos' })
    log.error({ err }, 'Falha inesperada ao registrar atualização de documentos de governança')
    return { error: 'Erro interno. Tente novamente em instantes.' }
  }
}
