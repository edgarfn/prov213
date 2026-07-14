/**
 * Central de Alertas de Prazo — fonte única que agrega todos os alertas de
 * prazo de uma serventia (etapas, incidentes críticos, vulnerabilidades,
 * teste de restauração atrasado). Consumida pelo dashboard (painel completo)
 * e pelo layout (badge de contagem na navegação) — ambos chamam
 * `getAlertasServentia`, nenhum recalcula os alertas por conta própria.
 */
import { differenceInDays } from 'date-fns'
import { db } from '@/lib/db'
import {
  calcularPrazos,
  calcularSemaforo,
  parametrosPorClasse,
  prazoIncidenteCritico,
  proximoTesteRestauracaoDevido,
  testeRestauracaoAtrasado,
  type SemaforoStatus,
} from '@/lib/business-rules'
import { getProrrogacaoAtivaData } from '@/lib/prorrogacao'
import type { ClasseServentia } from '@/app/generated/prisma/enums'

export type AlertaTipo =
  | 'ETAPA_PRAZO'
  | 'CONCLUSAO_PRAZO'
  | 'INCIDENTE_CRITICO'
  | 'VULNERABILIDADE_PRAZO'
  | 'TESTE_RESTAURACAO_ATRASADO'
  | 'PRORROGACAO_PROXIMA_LIMITE'
  | 'RECOMENDACAO_AGUARDANDO_PARECER_DPO'
  | 'RECOMENDACAO_AGUARDANDO_DECISAO'
  | 'RECOMENDACAO_PRAZO_IMPLANTACAO'
  | 'RECOMENDACAO_PRAZO_REAVALIACAO'

export interface Alerta {
  id: string
  tipo: AlertaTipo
  severidade: SemaforoStatus
  titulo: string
  descricao: string
  prazo: Date | null
  href: string
}

export interface ResumoAlertas {
  alertas: Alerta[]
  totalCriticos: number
  totalAtencao: number
  total: number
}

const SEVERIDADE_ORDEM: Record<SemaforoStatus, number> = { vermelho: 0, amarelo: 1, verde: 2 }

export interface MontarAlertasInput {
  hoje: Date
  classe: ClasseServentia
  prazoEtapas12: Date
  prazoConclusaoTotal: Date
  incidentesCriticosAbertos: Array<{
    id: string
    titulo: string
    dataCiencia: Date
    comunicadoCorregedoria: boolean
  }>
  vulnerabilidadesAbertas: Array<{ id: string; descricao: string; prazoLimite: Date }>
  ultimoTesteData: Date | null
  testeRestauracaoMeses: number
  /** Existe uma solicitação de prorrogação (Art. 21) aguardando decisão da Corregedoria */
  prorrogacaoPendente: boolean
  /** Recomendações Técnicas aguardando parecer do DPO (Etapa 3) */
  recomendacoesAguardandoParecerDpo: Array<{ id: string; codigo: string }>
  /** Recomendações Técnicas aguardando decisão do Controlador (Etapa 4) */
  recomendacoesAguardandoDecisao: Array<{ id: string; codigo: string }>
  /** Recomendações aprovadas com prazo de implantação definido, ainda não concluídas */
  recomendacoesComPrazoImplantacao: Array<{ id: string; codigo: string; prazoImplantacao: Date }>
  /** Recomendações com risco aceito temporariamente, aguardando reavaliação */
  recomendacoesComPrazoReavaliacao: Array<{ id: string; codigo: string; prazoReavaliacao: Date }>
}

/** Função pura de composição — sem acesso a banco, 100% testável. */
export function montarAlertas(input: MontarAlertasInput): Alerta[] {
  const {
    hoje,
    prazoEtapas12,
    prazoConclusaoTotal,
    incidentesCriticosAbertos,
    vulnerabilidadesAbertas,
    ultimoTesteData,
    testeRestauracaoMeses,
    prorrogacaoPendente,
    recomendacoesAguardandoParecerDpo,
    recomendacoesAguardandoDecisao,
    recomendacoesComPrazoImplantacao,
    recomendacoesComPrazoReavaliacao,
  } = input
  const alertas: Alerta[] = []

  if (prorrogacaoPendente) {
    alertas.push({
      id: 'PRORROGACAO_PROXIMA_LIMITE:pendente',
      tipo: 'PRORROGACAO_PROXIMA_LIMITE',
      severidade: 'amarelo',
      titulo: 'Prorrogação de prazo pendente de decisão',
      descricao: 'Há uma solicitação de prorrogação (Art. 21) aguardando decisão da Corregedoria competente.',
      prazo: null,
      href: '/configuracoes',
    })
  }

  const semaforoEtapas12 = calcularSemaforo(prazoEtapas12, hoje)
  if (semaforoEtapas12 !== 'verde') {
    alertas.push({
      id: 'ETAPA_PRAZO:etapas12',
      tipo: 'ETAPA_PRAZO',
      severidade: semaforoEtapas12,
      titulo: 'Prazo das Etapas 1 e 2 (Art. 20)',
      descricao:
        semaforoEtapas12 === 'vermelho'
          ? 'Prazo legal vencido.'
          : `Vence em ${differenceInDays(prazoEtapas12, hoje)} dia(s).`,
      prazo: prazoEtapas12,
      href: '/checklists',
    })
  }

  const semaforoConclusao = calcularSemaforo(prazoConclusaoTotal, hoje)
  if (semaforoConclusao !== 'verde') {
    alertas.push({
      id: 'CONCLUSAO_PRAZO:total',
      tipo: 'CONCLUSAO_PRAZO',
      severidade: semaforoConclusao,
      titulo: 'Prazo de conclusão total (Art. 23)',
      descricao:
        semaforoConclusao === 'vermelho'
          ? 'Prazo legal vencido.'
          : `Vence em ${differenceInDays(prazoConclusaoTotal, hoje)} dia(s).`,
      prazo: prazoConclusaoTotal,
      href: '/checklists',
    })
  }

  for (const inc of incidentesCriticosAbertos) {
    // Já comunicado à Corregedoria: a obrigação de prazo (72h) foi cumprida,
    // deixa de ser um alerta de prazo (o incidente em si continua no módulo).
    if (inc.comunicadoCorregedoria) continue
    const prazo = prazoIncidenteCritico(inc.dataCiencia)
    alertas.push({
      id: `INCIDENTE_CRITICO:${inc.id}`,
      tipo: 'INCIDENTE_CRITICO',
      severidade: calcularSemaforo(prazo, hoje),
      titulo: inc.titulo,
      descricao: `Comunicação à Corregedoria em até 72h da ciência — prazo: ${prazo.toLocaleString('pt-BR')}`,
      prazo,
      href: '/incidentes',
    })
  }

  for (const v of vulnerabilidadesAbertas) {
    const severidade = calcularSemaforo(v.prazoLimite, hoje)
    if (severidade === 'verde') continue
    alertas.push({
      id: `VULNERABILIDADE_PRAZO:${v.id}`,
      tipo: 'VULNERABILIDADE_PRAZO',
      severidade,
      titulo: v.descricao,
      descricao:
        severidade === 'vermelho'
          ? 'Prazo de tratamento vencido.'
          : `Prazo até ${v.prazoLimite.toLocaleDateString('pt-BR')}.`,
      prazo: v.prazoLimite,
      href: '/vulnerabilidades',
    })
  }

  for (const rec of recomendacoesAguardandoParecerDpo) {
    alertas.push({
      id: `RECOMENDACAO_AGUARDANDO_PARECER_DPO:${rec.id}`,
      tipo: 'RECOMENDACAO_AGUARDANDO_PARECER_DPO',
      severidade: 'amarelo',
      titulo: `Recomendação ${rec.codigo} aguardando parecer do DPO`,
      descricao: 'Envolve dados pessoais — o parecer de privacidade precisa ser registrado antes da decisão.',
      prazo: null,
      href: '/recomendacoes-tecnicas',
    })
  }

  for (const rec of recomendacoesAguardandoDecisao) {
    alertas.push({
      id: `RECOMENDACAO_AGUARDANDO_DECISAO:${rec.id}`,
      tipo: 'RECOMENDACAO_AGUARDANDO_DECISAO',
      severidade: 'amarelo',
      titulo: `Recomendação ${rec.codigo} aguardando decisão do Controlador`,
      descricao: 'A análise de risco (e o parecer do DPO, quando exigido) já foram concluídos.',
      prazo: null,
      href: '/recomendacoes-tecnicas',
    })
  }

  for (const rec of recomendacoesComPrazoImplantacao) {
    const severidade = calcularSemaforo(rec.prazoImplantacao, hoje)
    if (severidade === 'verde') continue
    alertas.push({
      id: `RECOMENDACAO_PRAZO_IMPLANTACAO:${rec.id}`,
      tipo: 'RECOMENDACAO_PRAZO_IMPLANTACAO',
      severidade,
      titulo: `Prazo de implantação da recomendação ${rec.codigo}`,
      descricao:
        severidade === 'vermelho'
          ? 'Prazo de implantação vencido.'
          : `Prazo até ${rec.prazoImplantacao.toLocaleDateString('pt-BR')}.`,
      prazo: rec.prazoImplantacao,
      href: '/recomendacoes-tecnicas',
    })
  }

  for (const rec of recomendacoesComPrazoReavaliacao) {
    const severidade = calcularSemaforo(rec.prazoReavaliacao, hoje)
    if (severidade === 'verde') continue
    alertas.push({
      id: `RECOMENDACAO_PRAZO_REAVALIACAO:${rec.id}`,
      tipo: 'RECOMENDACAO_PRAZO_REAVALIACAO',
      severidade,
      titulo: `Reavaliação do risco aceito na recomendação ${rec.codigo}`,
      descricao:
        severidade === 'vermelho'
          ? 'Prazo de reavaliação do risco aceito vencido.'
          : `Reavaliação prevista para ${rec.prazoReavaliacao.toLocaleDateString('pt-BR')}.`,
      prazo: rec.prazoReavaliacao,
      href: '/recomendacoes-tecnicas',
    })
  }

  const proximoTeste = proximoTesteRestauracaoDevido(ultimoTesteData, testeRestauracaoMeses)
  if (testeRestauracaoAtrasado(proximoTeste, hoje)) {
    alertas.push({
      id: 'TESTE_RESTAURACAO_ATRASADO:unico',
      tipo: 'TESTE_RESTAURACAO_ATRASADO',
      severidade: 'vermelho',
      titulo: ultimoTesteData ? 'Teste de restauração atrasado' : 'Nenhum teste de restauração registrado',
      descricao: proximoTeste
        ? `Devido desde ${proximoTeste.toLocaleDateString('pt-BR')}.`
        : 'Nenhum teste de restauração foi registrado ainda.',
      prazo: proximoTeste,
      href: '/testes-restauracao',
    })
  }

  alertas.sort((a, b) => {
    const diff = SEVERIDADE_ORDEM[a.severidade] - SEVERIDADE_ORDEM[b.severidade]
    if (diff !== 0) return diff
    if (!a.prazo || !b.prazo) return 0
    return a.prazo.getTime() - b.prazo.getTime()
  })

  return alertas
}

export function resumirAlertas(alertas: Alerta[]): ResumoAlertas {
  return {
    alertas,
    totalCriticos: alertas.filter((a) => a.severidade === 'vermelho').length,
    totalAtencao: alertas.filter((a) => a.severidade === 'amarelo').length,
    total: alertas.length,
  }
}

/**
 * Orquestrador — busca os dados via Prisma e monta o resumo de alertas.
 * Chamada tanto pelo dashboard (painel completo) quanto pelo layout
 * (badge da barra lateral) — nenhum dos dois deve recalcular por conta própria.
 */
export async function getAlertasServentia(
  serventiaId: string,
  hoje: Date = new Date(),
): Promise<ResumoAlertas> {
  const serventia = await db.serventia.findUniqueOrThrow({
    where: { id: serventiaId },
    select: { classe: true, dataVigenciaNorma: true },
  })

  const [
    incidentesCriticosAbertos,
    vulnerabilidadesAbertas,
    ultimoTeste,
    prorrogacaoNovaData,
    prorrogacaoPendente,
    recomendacoesAguardandoParecerDpo,
    recomendacoesAguardandoDecisao,
    recomendacoesComPrazoImplantacaoRaw,
    recomendacoesComPrazoReavaliacaoRaw,
  ] = await Promise.all([
      db.incidente.findMany({
        where: { serventiaId, gravidade: 'CRITICO', status: { not: 'ENCERRADO' } },
        select: { id: true, titulo: true, dataCiencia: true, comunicadoCorregedoria: true },
      }),
      db.vulnerabilidade.findMany({
        where: { serventiaId, dataEncerramento: null },
        select: { id: true, descricao: true, prazoLimite: true },
      }),
      db.testeRestauracao.findFirst({
        where: { serventiaId },
        orderBy: { dataTeste: 'desc' },
        select: { dataTeste: true },
      }),
      getProrrogacaoAtivaData(serventiaId),
      db.prorrogacao.findFirst({ where: { serventiaId, status: 'SOLICITADA' }, select: { id: true } }),
      db.recomendacaoTecnica.findMany({
        where: { serventiaId, status: 'AGUARDANDO_PARECER_DPO' },
        select: { id: true, codigo: true },
      }),
      db.recomendacaoTecnica.findMany({
        where: { serventiaId, status: 'AGUARDANDO_DECISAO' },
        select: { id: true, codigo: true },
      }),
      db.recomendacaoTecnica.findMany({
        where: {
          serventiaId,
          prazoImplantacao: { not: null },
          status: { in: ['APROVADO_AGUARDANDO_IMPLEMENTACAO', 'EM_IMPLEMENTACAO'] },
        },
        select: { id: true, codigo: true, prazoImplantacao: true },
      }),
      db.recomendacaoTecnica.findMany({
        where: { serventiaId, status: 'RISCO_ACEITO_TEMPORARIO', prazoReavaliacao: { not: null } },
        select: { id: true, codigo: true, prazoReavaliacao: true },
      }),
    ])

  const recomendacoesComPrazoImplantacao = recomendacoesComPrazoImplantacaoRaw.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    prazoImplantacao: r.prazoImplantacao as Date,
  }))
  const recomendacoesComPrazoReavaliacao = recomendacoesComPrazoReavaliacaoRaw.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    prazoReavaliacao: r.prazoReavaliacao as Date,
  }))

  const prazos = calcularPrazos(serventia.dataVigenciaNorma, serventia.classe, !!prorrogacaoNovaData, prorrogacaoNovaData)
  const params = parametrosPorClasse(serventia.classe)

  const alertas = montarAlertas({
    hoje,
    classe: serventia.classe,
    prazoEtapas12: prazos.etapas12,
    prazoConclusaoTotal: prazos.conclusaoTotal,
    incidentesCriticosAbertos,
    vulnerabilidadesAbertas,
    ultimoTesteData: ultimoTeste?.dataTeste ?? null,
    testeRestauracaoMeses: params.testeRestauracaoMeses,
    prorrogacaoPendente: !!prorrogacaoPendente,
    recomendacoesAguardandoParecerDpo,
    recomendacoesAguardandoDecisao,
    recomendacoesComPrazoImplantacao,
    recomendacoesComPrazoReavaliacao,
  })

  return resumirAlertas(alertas)
}
