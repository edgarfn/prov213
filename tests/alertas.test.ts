import { describe, it, expect } from 'vitest'
import { addDays, addMonths } from 'date-fns'
import { montarAlertas, resumirAlertas, type MontarAlertasInput } from '../lib/alertas'

const HOJE = new Date('2026-07-04T12:00:00Z')

function baseInput(overrides: Partial<MontarAlertasInput> = {}): MontarAlertasInput {
  return {
    hoje: HOJE,
    classe: 'CLASSE_2',
    prazoEtapas12: addDays(HOJE, 90), // bem longe, verde
    prazoConclusaoTotal: addMonths(HOJE, 24), // bem longe, verde
    incidentesCriticosAbertos: [],
    vulnerabilidadesAbertas: [],
    ultimoTesteData: addDays(HOJE, -10), // testado recentemente
    testeRestauracaoMeses: 12,
    prorrogacaoPendente: false,
    recomendacoesAguardandoParecerDpo: [],
    recomendacoesAguardandoDecisao: [],
    recomendacoesComPrazoImplantacao: [],
    recomendacoesComPrazoReavaliacao: [],
    ...overrides,
  }
}

describe('montarAlertas', () => {
  it('Sem alertas quando tudo está em dia (verde)', () => {
    expect(montarAlertas(baseInput())).toEqual([])
  })

  it('Prazo de etapas 1+2 em amarelo gera alerta', () => {
    const alertas = montarAlertas(baseInput({ prazoEtapas12: addDays(HOJE, 15) }))
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'ETAPA_PRAZO', severidade: 'amarelo', href: '/checklists' })
  })

  it('Prazo de etapas 1+2 vencido gera alerta vermelho', () => {
    const alertas = montarAlertas(baseInput({ prazoEtapas12: addDays(HOJE, -1) }))
    expect(alertas[0]).toMatchObject({ tipo: 'ETAPA_PRAZO', severidade: 'vermelho' })
  })

  it('Prazo de conclusão total gera alerta próprio, independente das etapas 1+2', () => {
    const alertas = montarAlertas(baseInput({ prazoConclusaoTotal: addDays(HOJE, -1) }))
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'CONCLUSAO_PRAZO', severidade: 'vermelho', href: '/checklists' })
  })

  it('Incidente crítico não comunicado gera alerta com prazo de 72h', () => {
    const dataCiencia = new Date('2026-07-03T12:00:00Z') // 24h atrás → 48h restantes do prazo de 72h
    const alertas = montarAlertas(
      baseInput({
        incidentesCriticosAbertos: [
          { id: 'inc-1', titulo: 'Vazamento de dados', dataCiencia, comunicadoCorregedoria: false },
        ],
      }),
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'INCIDENTE_CRITICO', href: '/incidentes' })
  })

  it('Incidente crítico já comunicado à Corregedoria não gera alerta de prazo', () => {
    const alertas = montarAlertas(
      baseInput({
        incidentesCriticosAbertos: [
          {
            id: 'inc-2',
            titulo: 'Já comunicado',
            dataCiencia: addDays(HOJE, -1),
            comunicadoCorregedoria: true,
          },
        ],
      }),
    )
    expect(alertas).toHaveLength(0)
  })

  it('Vulnerabilidade verde (prazo confortável) não gera alerta', () => {
    const alertas = montarAlertas(
      baseInput({
        vulnerabilidadesAbertas: [{ id: 'v-1', descricao: 'Falha leve', prazoLimite: addDays(HOJE, 60) }],
      }),
    )
    expect(alertas).toHaveLength(0)
  })

  it('Vulnerabilidade vencida gera alerta vermelho', () => {
    const alertas = montarAlertas(
      baseInput({
        vulnerabilidadesAbertas: [{ id: 'v-2', descricao: 'Falha crítica', prazoLimite: addDays(HOJE, -2) }],
      }),
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'VULNERABILIDADE_PRAZO', severidade: 'vermelho', href: '/vulnerabilidades' })
  })

  it('Nunca testado (restauração) gera alerta vermelho', () => {
    const alertas = montarAlertas(baseInput({ ultimoTesteData: null }))
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'TESTE_RESTAURACAO_ATRASADO', href: '/testes-restauracao' })
  })

  it('Teste de restauração atrasado gera alerta', () => {
    const alertas = montarAlertas(
      baseInput({ ultimoTesteData: addMonths(HOJE, -13), testeRestauracaoMeses: 12 }),
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0].tipo).toBe('TESTE_RESTAURACAO_ATRASADO')
  })

  it('Prorrogação pendente de decisão gera alerta amarelo (Art. 21)', () => {
    const alertas = montarAlertas(baseInput({ prorrogacaoPendente: true }))
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({
      tipo: 'PRORROGACAO_PROXIMA_LIMITE',
      severidade: 'amarelo',
      href: '/configuracoes',
    })
  })

  it('Recomendação aguardando parecer do DPO gera alerta amarelo', () => {
    const alertas = montarAlertas(
      baseInput({ recomendacoesAguardandoParecerDpo: [{ id: 'rt-1', codigo: 'RT-123-2026-001' }] }),
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({
      tipo: 'RECOMENDACAO_AGUARDANDO_PARECER_DPO',
      severidade: 'amarelo',
      href: '/recomendacoes-tecnicas',
    })
  })

  it('Recomendação aguardando decisão do Controlador gera alerta amarelo', () => {
    const alertas = montarAlertas(
      baseInput({ recomendacoesAguardandoDecisao: [{ id: 'rt-2', codigo: 'RT-123-2026-002' }] }),
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'RECOMENDACAO_AGUARDANDO_DECISAO', severidade: 'amarelo' })
  })

  it('Prazo de implantação confortável não gera alerta', () => {
    const alertas = montarAlertas(
      baseInput({
        recomendacoesComPrazoImplantacao: [{ id: 'rt-3', codigo: 'RT-123-2026-003', prazoImplantacao: addDays(HOJE, 60) }],
      }),
    )
    expect(alertas).toHaveLength(0)
  })

  it('Prazo de implantação vencido gera alerta vermelho', () => {
    const alertas = montarAlertas(
      baseInput({
        recomendacoesComPrazoImplantacao: [{ id: 'rt-4', codigo: 'RT-123-2026-004', prazoImplantacao: addDays(HOJE, -2) }],
      }),
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'RECOMENDACAO_PRAZO_IMPLANTACAO', severidade: 'vermelho', href: '/recomendacoes-tecnicas' })
  })

  it('Prazo de reavaliação de risco aceito próximo gera alerta amarelo', () => {
    const alertas = montarAlertas(
      baseInput({
        recomendacoesComPrazoReavaliacao: [{ id: 'rt-5', codigo: 'RT-123-2026-005', prazoReavaliacao: addDays(HOJE, 10) }],
      }),
    )
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'RECOMENDACAO_PRAZO_REAVALIACAO', severidade: 'amarelo' })
  })

  it('Ordena vermelho antes de amarelo', () => {
    const alertas = montarAlertas(
      baseInput({
        prazoEtapas12: addDays(HOJE, 15), // amarelo
        prazoConclusaoTotal: addDays(HOJE, -5), // vermelho
      }),
    )
    expect(alertas.map((a) => a.severidade)).toEqual(['vermelho', 'amarelo'])
  })
})

describe('resumirAlertas', () => {
  it('Conta corretamente críticos e de atenção', () => {
    const alertas = montarAlertas(
      baseInput({
        prazoEtapas12: addDays(HOJE, 15), // amarelo
        prazoConclusaoTotal: addDays(HOJE, -5), // vermelho
        ultimoTesteData: addMonths(HOJE, -13), // vermelho
      }),
    )
    const resumo = resumirAlertas(alertas)
    expect(resumo.total).toBe(3)
    expect(resumo.totalCriticos).toBe(2)
    expect(resumo.totalAtencao).toBe(1)
  })
})
