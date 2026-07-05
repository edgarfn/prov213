import { describe, it, expect } from 'vitest'
import { addDays, addMonths, addYears } from 'date-fns'
import {
  calcularPrazos,
  calcularSemaforo,
  parametrosPorClasse,
  prazoIncidenteCritico,
  prazoVulnerabilidade,
  calcularClassePorArrecadacao,
  calcularSubclasse,
  podeDeclaraEtapa,
  requisitoAplicavel,
  evidenciaBloqueadaPorRetencao,
  dataLimiteRetencaoEvidencia,
  proximoTesteRestauracaoDevido,
  testeRestauracaoAtrasado,
  classificacaoRiscoPorCvss,
} from '../lib/business-rules'

const VIGENCIA = new Date('2026-01-01')

// ─── Cálculo de prazos ────────────────────────────────────────────────────────

describe('calcularPrazos', () => {
  it('Classe 3: etapas 1+2 em 90 dias', () => {
    const { etapas12 } = calcularPrazos(VIGENCIA, 'CLASSE_3')
    expect(etapas12).toEqual(addDays(VIGENCIA, 90))
  })

  it('Classe 2: etapas 1+2 em 150 dias', () => {
    const { etapas12 } = calcularPrazos(VIGENCIA, 'CLASSE_2')
    expect(etapas12).toEqual(addDays(VIGENCIA, 150))
  })

  it('Classe 1: etapas 1+2 em 210 dias', () => {
    const { etapas12 } = calcularPrazos(VIGENCIA, 'CLASSE_1')
    expect(etapas12).toEqual(addDays(VIGENCIA, 210))
  })

  it('Classe 3: conclusão total em 24 meses', () => {
    const { conclusaoTotal } = calcularPrazos(VIGENCIA, 'CLASSE_3')
    expect(conclusaoTotal).toEqual(addMonths(VIGENCIA, 24))
  })

  it('Classe 2: conclusão total em 30 meses', () => {
    const { conclusaoTotal } = calcularPrazos(VIGENCIA, 'CLASSE_2')
    expect(conclusaoTotal).toEqual(addMonths(VIGENCIA, 30))
  })

  it('Classe 1: conclusão total em 36 meses', () => {
    const { conclusaoTotal } = calcularPrazos(VIGENCIA, 'CLASSE_1')
    expect(conclusaoTotal).toEqual(addMonths(VIGENCIA, 36))
  })

  it('Prorrogação usa nova data para etapas 1+2', () => {
    const novaData = new Date('2026-06-01')
    const { etapas12 } = calcularPrazos(VIGENCIA, 'CLASSE_3', true, novaData)
    expect(etapas12).toEqual(novaData)
  })
})

// ─── Semáforo ─────────────────────────────────────────────────────────────────

describe('calcularSemaforo', () => {
  it('Verde quando mais de 30 dias', () => {
    const prazo = addDays(new Date(), 31)
    expect(calcularSemaforo(prazo)).toBe('verde')
  })

  it('Amarelo quando 30 dias ou menos', () => {
    const prazo = addDays(new Date(), 30)
    expect(calcularSemaforo(prazo)).toBe('amarelo')
  })

  it('Amarelo quando 1 dia', () => {
    const prazo = addDays(new Date(), 1)
    expect(calcularSemaforo(prazo)).toBe('amarelo')
  })

  it('Vermelho quando vencido', () => {
    const prazo = addDays(new Date(), -1)
    expect(calcularSemaforo(prazo)).toBe('vermelho')
  })
})

// ─── Parâmetros técnicos por classe ──────────────────────────────────────────

describe('parametrosPorClasse', () => {
  it('Classe 3: RPO=4h, RTO=8h, backup=24h, internet=50Mbps, pentest=true', () => {
    const p = parametrosPorClasse('CLASSE_3')
    expect(p.rpoHoras).toBe(4)
    expect(p.rtoHoras).toBe(8)
    expect(p.backupCompletoHoras).toBe(24)
    expect(p.internetMbps).toBe(50)
    expect(p.pentest).toBe(true)
    expect(p.testeRestauracaoMeses).toBe(6)
  })

  it('Classe 2: RPO=12h, RTO=24h, backup=48h, internet=10Mbps, pentest=false', () => {
    const p = parametrosPorClasse('CLASSE_2')
    expect(p.rpoHoras).toBe(12)
    expect(p.rtoHoras).toBe(24)
    expect(p.backupCompletoHoras).toBe(48)
    expect(p.internetMbps).toBe(10)
    expect(p.pentest).toBe(false)
  })

  it('Classe 1: RPO=24h, RTO=24h, backup=72h, internet=2Mbps', () => {
    const p = parametrosPorClasse('CLASSE_1')
    expect(p.rpoHoras).toBe(24)
    expect(p.rtoHoras).toBe(24)
    expect(p.backupCompletoHoras).toBe(72)
    expect(p.internetMbps).toBe(2)
  })

  it('Todas as classes retêm por 5 anos', () => {
    expect(parametrosPorClasse('CLASSE_1').retencaoAnos).toBe(5)
    expect(parametrosPorClasse('CLASSE_2').retencaoAnos).toBe(5)
    expect(parametrosPorClasse('CLASSE_3').retencaoAnos).toBe(5)
  })
})

// ─── Incidentes ───────────────────────────────────────────────────────────────

describe('prazoIncidenteCritico', () => {
  it('Deve ser exatamente 72h após ciência', () => {
    const ciencia = new Date('2026-01-01T10:00:00Z')
    const prazo = prazoIncidenteCritico(ciencia)
    expect(prazo).toEqual(new Date('2026-01-04T10:00:00Z'))
  })
})

// ─── Vulnerabilidades ─────────────────────────────────────────────────────────

describe('prazoVulnerabilidade', () => {
  it('Exploração ativa: 72h', () => {
    const base = new Date('2026-01-01T00:00:00Z')
    const prazo = prazoVulnerabilidade(base, true)
    expect(prazo).toEqual(new Date('2026-01-04T00:00:00Z'))
  })

  it('Sem exploração ativa: 30 dias', () => {
    const base = new Date('2026-01-01')
    const prazo = prazoVulnerabilidade(base, false)
    expect(prazo).toEqual(addDays(base, 30))
  })
})

describe('classificacaoRiscoPorCvss', () => {
  it('9.0–10.0 é CRITICO', () => {
    expect(classificacaoRiscoPorCvss(9.0)).toBe('CRITICO')
    expect(classificacaoRiscoPorCvss(10.0)).toBe('CRITICO')
  })

  it('7.0–8.9 é ALTO', () => {
    expect(classificacaoRiscoPorCvss(7.0)).toBe('ALTO')
    expect(classificacaoRiscoPorCvss(8.9)).toBe('ALTO')
  })

  it('4.0–6.9 é MEDIO', () => {
    expect(classificacaoRiscoPorCvss(4.0)).toBe('MEDIO')
    expect(classificacaoRiscoPorCvss(6.9)).toBe('MEDIO')
  })

  it('abaixo de 4.0 é BAIXO', () => {
    expect(classificacaoRiscoPorCvss(0)).toBe('BAIXO')
    expect(classificacaoRiscoPorCvss(3.9)).toBe('BAIXO')
  })
})

// ─── Classificação por arrecadação ──────────────────────────────────────────

describe('calcularClassePorArrecadacao', () => {
  it('até 100k (inclusive) → Classe 1 (Art. 16, I: "não ultrapasse")', () => {
    expect(calcularClassePorArrecadacao(50000)).toBe('CLASSE_1')
    expect(calcularClassePorArrecadacao(99999)).toBe('CLASSE_1')
    expect(calcularClassePorArrecadacao(100000)).toBe('CLASSE_1')
  })

  it('acima de 100k até 500k (inclusive) → Classe 2', () => {
    expect(calcularClassePorArrecadacao(100000.01)).toBe('CLASSE_2')
    expect(calcularClassePorArrecadacao(499999)).toBe('CLASSE_2')
    expect(calcularClassePorArrecadacao(500000)).toBe('CLASSE_2')
  })

  it('acima de 500k → Classe 3 (Art. 16, III: "ultrapasse o limite da Classe 2")', () => {
    expect(calcularClassePorArrecadacao(500000.01)).toBe('CLASSE_3')
    expect(calcularClassePorArrecadacao(2000000)).toBe('CLASSE_3')
  })
})

// ─── Subclasses A–J ───────────────────────────────────────────────────────────

describe('calcularSubclasse', () => {
  it('Classe 1: terços de 100k → A, B, C', () => {
    expect(calcularSubclasse(30000, 'CLASSE_1')).toBe('A')
    expect(calcularSubclasse(33333.33, 'CLASSE_1')).toBe('A')
    expect(calcularSubclasse(50000, 'CLASSE_1')).toBe('B')
    expect(calcularSubclasse(90000, 'CLASSE_1')).toBe('C')
  })

  it('Classe 2: terços da faixa 100k–500k → D, E, F', () => {
    expect(calcularSubclasse(150000, 'CLASSE_2')).toBe('D')
    expect(calcularSubclasse(300000, 'CLASSE_2')).toBe('E')
    expect(calcularSubclasse(450000, 'CLASSE_2')).toBe('F')
  })

  it('Classe 3: múltiplos de 500k → G, H, I, J', () => {
    expect(calcularSubclasse(1000000, 'CLASSE_3')).toBe('G')
    expect(calcularSubclasse(2000000, 'CLASSE_3')).toBe('H')
    expect(calcularSubclasse(5000000, 'CLASSE_3')).toBe('I')
    expect(calcularSubclasse(7000000, 'CLASSE_3')).toBe('J')
  })
})

// ─── Sequencialidade de etapas ───────────────────────────────────────────────

describe('podeDeclaraEtapa', () => {
  it('Etapa 1 sempre pode ser declarada se concluída', () => {
    expect(podeDeclaraEtapa(1, [], true)).toBe(true)
  })

  it('Etapa 1 não pode ser declarada se não concluída', () => {
    expect(podeDeclaraEtapa(1, [], false)).toBe(false)
  })

  it('Etapa 2 requer etapa 1 declarada', () => {
    expect(podeDeclaraEtapa(2, [1], true)).toBe(true)
    expect(podeDeclaraEtapa(2, [], true)).toBe(false)
  })

  it('Etapa 5 requer etapas 1–4 declaradas', () => {
    expect(podeDeclaraEtapa(5, [1, 2, 3, 4], true)).toBe(true)
    expect(podeDeclaraEtapa(5, [1, 2, 3], true)).toBe(false)
    expect(podeDeclaraEtapa(5, [], true)).toBe(false)
  })

  it('Mesmo com todas declaradas, não pode se não concluída', () => {
    expect(podeDeclaraEtapa(3, [1, 2], false)).toBe(false)
  })
})

// ─── Retenção de evidências (Art. 7º, IV) ────────────────────────────────────

describe('evidenciaBloqueadaPorRetencao', () => {
  it('Bloqueada no dia seguinte ao upload (dentro dos 5 anos)', () => {
    const uploadedAt = new Date('2026-01-01')
    const hoje = addDays(uploadedAt, 1)
    expect(evidenciaBloqueadaPorRetencao(uploadedAt, 5, hoje)).toBe(true)
  })

  it('Ainda bloqueada um dia antes de completar o prazo', () => {
    const uploadedAt = new Date('2026-01-01')
    const hoje = addDays(addYears(uploadedAt, 5), -1)
    expect(evidenciaBloqueadaPorRetencao(uploadedAt, 5, hoje)).toBe(true)
  })

  it('Liberada após completar o prazo de retenção', () => {
    const uploadedAt = new Date('2026-01-01')
    const hoje = addDays(addYears(uploadedAt, 5), 1)
    expect(evidenciaBloqueadaPorRetencao(uploadedAt, 5, hoje)).toBe(false)
  })
})

describe('dataLimiteRetencaoEvidencia', () => {
  it('Calcula a data-limite como uploadedAt + retencaoAnos', () => {
    const uploadedAt = new Date('2026-01-01')
    expect(dataLimiteRetencaoEvidencia(uploadedAt, 5)).toEqual(addYears(uploadedAt, 5))
  })
})

// ─── Próximo teste de restauração devido (Anexo I, item 5, V) ────────────────

describe('proximoTesteRestauracaoDevido', () => {
  it('Retorna null se nunca houve teste', () => {
    expect(proximoTesteRestauracaoDevido(null, 6)).toBeNull()
  })

  it('Soma a periodicidade em meses à data do último teste', () => {
    const ultimo = new Date('2026-01-01')
    expect(proximoTesteRestauracaoDevido(ultimo, 6)).toEqual(addMonths(ultimo, 6))
  })
})

describe('testeRestauracaoAtrasado', () => {
  it('Nunca testado (null) conta como atrasado', () => {
    expect(testeRestauracaoAtrasado(null)).toBe(true)
  })

  it('Não atrasado quando o próximo devido ainda não chegou', () => {
    expect(testeRestauracaoAtrasado(addDays(new Date(), 5))).toBe(false)
  })

  it('Atrasado quando o próximo devido já passou', () => {
    expect(testeRestauracaoAtrasado(addDays(new Date(), -5))).toBe(true)
  })
})

// ─── Aplicabilidade por classe ────────────────────────────────────────────────

describe('requisitoAplicavel', () => {
  it('Retorna true se classe está na lista', () => {
    expect(requisitoAplicavel(['CLASSE_2', 'CLASSE_3'], 'CLASSE_3')).toBe(true)
  })

  it('Retorna false se classe não está na lista', () => {
    expect(requisitoAplicavel(['CLASSE_2', 'CLASSE_3'], 'CLASSE_1')).toBe(false)
  })

  it('Aplicável a todas as classes', () => {
    expect(requisitoAplicavel(['CLASSE_1', 'CLASSE_2', 'CLASSE_3'], 'CLASSE_1')).toBe(true)
    expect(requisitoAplicavel(['CLASSE_1', 'CLASSE_2', 'CLASSE_3'], 'CLASSE_2')).toBe(true)
    expect(requisitoAplicavel(['CLASSE_1', 'CLASSE_2', 'CLASSE_3'], 'CLASSE_3')).toBe(true)
  })
})
