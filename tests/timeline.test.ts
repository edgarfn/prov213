import { describe, it, expect } from 'vitest'
import { addDays } from 'date-fns'
import { montarTimelineEtapas, type MontarTimelineInput } from '../lib/timeline'

const VIGENCIA = new Date('2026-01-01')
const HOJE = new Date('2026-07-04')

function baseInput(overrides: Partial<MontarTimelineInput> = {}): MontarTimelineInput {
  return {
    hoje: HOJE,
    dataVigencia: VIGENCIA,
    prazoEtapas12: addDays(VIGENCIA, 150),
    prazoConclusaoTotal: addDays(VIGENCIA, 900),
    etapas: [
      { numero: 1, titulo: 'Governança', dataDeclaracao: null, percentualConcluido: 0 },
      { numero: 2, titulo: 'Infraestrutura', dataDeclaracao: null, percentualConcluido: 0 },
      { numero: 3, titulo: 'Proteção do acervo', dataDeclaracao: null, percentualConcluido: 0 },
      { numero: 4, titulo: 'Monitoramento', dataDeclaracao: null, percentualConcluido: 0 },
      { numero: 5, titulo: 'Interoperabilidade', dataDeclaracao: null, percentualConcluido: 0 },
    ],
    ...overrides,
  }
}

describe('montarTimelineEtapas', () => {
  it('Etapa não iniciada (0% e sem declaração)', () => {
    const [etapa1] = montarTimelineEtapas(baseInput())
    expect(etapa1.status).toBe('NAO_INICIADA')
  })

  it('Etapa em andamento e dentro do prazo', () => {
    const input = baseInput({
      etapas: [{ numero: 1, titulo: 'Governança', dataDeclaracao: null, percentualConcluido: 40 }],
      hoje: addDays(VIGENCIA, 10),
    })
    const [etapa1] = montarTimelineEtapas(input)
    expect(etapa1.status).toBe('EM_ANDAMENTO_NO_PRAZO')
  })

  it('Etapa em andamento e atrasada (prazo já vencido)', () => {
    const input = baseInput({
      etapas: [{ numero: 1, titulo: 'Governança', dataDeclaracao: null, percentualConcluido: 40 }],
      hoje: addDays(VIGENCIA, 200), // após o prazo de 150 dias
    })
    const [etapa1] = montarTimelineEtapas(input)
    expect(etapa1.status).toBe('EM_ANDAMENTO_ATRASADA')
  })

  it('Etapa concluída dentro do prazo', () => {
    const input = baseInput({
      etapas: [{ numero: 1, titulo: 'Governança', dataDeclaracao: addDays(VIGENCIA, 100), percentualConcluido: 100 }],
    })
    const [etapa1] = montarTimelineEtapas(input)
    expect(etapa1.status).toBe('CONCLUIDA_NO_PRAZO')
  })

  it('Etapa concluída fora do prazo', () => {
    const input = baseInput({
      etapas: [{ numero: 1, titulo: 'Governança', dataDeclaracao: addDays(VIGENCIA, 200), percentualConcluido: 100 }],
    })
    const [etapa1] = montarTimelineEtapas(input)
    expect(etapa1.status).toBe('CONCLUIDA_ATRASADA')
  })

  it('Etapas 1 e 2 usam o prazo do Art. 20; Etapas 3-5 usam o prazo do Art. 23', () => {
    const itens = montarTimelineEtapas(baseInput())
    expect(itens[0].dataFimPrevista).toEqual(addDays(VIGENCIA, 150))
    expect(itens[1].dataFimPrevista).toEqual(addDays(VIGENCIA, 150))
    expect(itens[2].dataFimPrevista).toEqual(addDays(VIGENCIA, 900))
    expect(itens[3].dataFimPrevista).toEqual(addDays(VIGENCIA, 900))
    expect(itens[4].dataFimPrevista).toEqual(addDays(VIGENCIA, 900))
  })

  it('O início previsto da etapa N é a data de declaração da etapa N-1', () => {
    const dataDeclaracao1 = addDays(VIGENCIA, 50)
    const input = baseInput({
      etapas: [
        { numero: 1, titulo: 'Governança', dataDeclaracao: dataDeclaracao1, percentualConcluido: 100 },
        { numero: 2, titulo: 'Infraestrutura', dataDeclaracao: null, percentualConcluido: 20 },
      ],
    })
    const [, etapa2] = montarTimelineEtapas(input)
    expect(etapa2.dataInicioPrevista).toEqual(dataDeclaracao1)
  })
})
