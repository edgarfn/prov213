/**
 * Timeline/Gantt simplificado das 5 etapas do Anexo IV (spec 5.1: "linha do
 * tempo / Gantt simplificado: etapas com prazos legais e datas
 * previstas/reais"). Função pura — sem acesso a banco, 100% testável.
 *
 * Prazo legal de referência por etapa: Etapas 1 e 2 compartilham o prazo do
 * Art. 20 (implementação inicial); Etapas 3 a 5 não têm prazo individual na
 * norma — usam o prazo de conclusão total do Art. 23 como limite externo
 * (Art. 23, parágrafo único: as etapas subsequentes observam a ordem
 * sequencial e cumulativa dentro do prazo global).
 */

export type EtapaTimelineStatus =
  | 'CONCLUIDA_NO_PRAZO'
  | 'CONCLUIDA_ATRASADA'
  | 'EM_ANDAMENTO_NO_PRAZO'
  | 'EM_ANDAMENTO_ATRASADA'
  | 'NAO_INICIADA'

export interface EtapaTimelineItem {
  numero: number
  titulo: string
  dataInicioPrevista: Date
  dataFimPrevista: Date
  dataDeclaracao: Date | null
  status: EtapaTimelineStatus
}

export interface EtapaTimelineInput {
  numero: number
  titulo: string
  dataDeclaracao: Date | null
  percentualConcluido: number
}

export interface MontarTimelineInput {
  etapas: EtapaTimelineInput[]
  dataVigencia: Date
  prazoEtapas12: Date
  prazoConclusaoTotal: Date
  hoje?: Date
}

export function montarTimelineEtapas(input: MontarTimelineInput): EtapaTimelineItem[] {
  const hoje = input.hoje ?? new Date()
  const etapasOrdenadas = [...input.etapas].sort((a, b) => a.numero - b.numero)

  let inicioAnterior = input.dataVigencia
  const itens: EtapaTimelineItem[] = []

  for (const etapa of etapasOrdenadas) {
    const dataFimPrevista = etapa.numero <= 2 ? input.prazoEtapas12 : input.prazoConclusaoTotal
    const dataInicioPrevista = inicioAnterior

    let status: EtapaTimelineStatus
    if (etapa.dataDeclaracao) {
      status = etapa.dataDeclaracao <= dataFimPrevista ? 'CONCLUIDA_NO_PRAZO' : 'CONCLUIDA_ATRASADA'
    } else if (etapa.percentualConcluido <= 0) {
      status = 'NAO_INICIADA'
    } else {
      status = hoje > dataFimPrevista ? 'EM_ANDAMENTO_ATRASADA' : 'EM_ANDAMENTO_NO_PRAZO'
    }

    itens.push({
      numero: etapa.numero,
      titulo: etapa.titulo,
      dataInicioPrevista,
      dataFimPrevista,
      dataDeclaracao: etapa.dataDeclaracao,
      status,
    })

    // A próxima etapa só "começa" de fato quando esta é declarada; até lá,
    // mantém o mesmo início previsto (execução em paralelo/atrasada é possível
    // na prática, mas a ordem sequencial de declaração é a exigida pela norma).
    inicioAnterior = etapa.dataDeclaracao ?? inicioAnterior
  }

  return itens
}
