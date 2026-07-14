import { describe, it, expect } from 'vitest'
import {
  proximoStatusAposAnaliseRisco,
  proximoStatusAposDecisao,
  proximoStatusAposAceite,
  exigeTermoCiencia,
  formatarCodigoRecomendacao,
} from '../lib/recomendacao-tecnica'

describe('proximoStatusAposAnaliseRisco', () => {
  it('vai para AGUARDANDO_PARECER_DPO quando envolve dados pessoais', () => {
    expect(proximoStatusAposAnaliseRisco(true)).toBe('AGUARDANDO_PARECER_DPO')
  })

  it('vai direto para AGUARDANDO_DECISAO quando não envolve dados pessoais', () => {
    expect(proximoStatusAposAnaliseRisco(false)).toBe('AGUARDANDO_DECISAO')
  })
})

describe('proximoStatusAposDecisao', () => {
  it('REJEITADO é terminal próprio', () => {
    expect(proximoStatusAposDecisao('REJEITADO')).toBe('REJEITADO')
  })

  it('RISCO_ACEITO_TEMPORARIO é terminal próprio', () => {
    expect(proximoStatusAposDecisao('RISCO_ACEITO_TEMPORARIO')).toBe('RISCO_ACEITO_TEMPORARIO')
  })

  it('COMPLEMENTACAO_SOLICITADA reabre as Etapas 1/2', () => {
    expect(proximoStatusAposDecisao('COMPLEMENTACAO_SOLICITADA')).toBe('COMPLEMENTACAO_SOLICITADA')
  })

  it.each([
    'APROVADO_INTEGRAL',
    'APROVADO_COM_CONDICOES',
    'APROVADO_IMPLANTACAO_FUTURA',
    'SUBSTITUIDO_EQUIVALENTE',
  ] as const)('%s libera a Etapa 5 (APROVADO_AGUARDANDO_IMPLEMENTACAO)', (decisao) => {
    expect(proximoStatusAposDecisao(decisao)).toBe('APROVADO_AGUARDANDO_IMPLEMENTACAO')
  })
})

describe('exigeTermoCiencia', () => {
  it('exige termo para REJEITADO', () => {
    expect(exigeTermoCiencia('REJEITADO')).toBe(true)
  })

  it('exige termo para RISCO_ACEITO_TEMPORARIO', () => {
    expect(exigeTermoCiencia('RISCO_ACEITO_TEMPORARIO')).toBe(true)
  })

  it('não exige termo para decisões de aprovação', () => {
    expect(exigeTermoCiencia('APROVADO_INTEGRAL')).toBe(false)
    expect(exigeTermoCiencia('APROVADO_COM_CONDICOES')).toBe(false)
    expect(exigeTermoCiencia('APROVADO_IMPLANTACAO_FUTURA')).toBe(false)
    expect(exigeTermoCiencia('SUBSTITUIDO_EQUIVALENTE')).toBe(false)
  })

  it('não exige termo para complementação solicitada', () => {
    expect(exigeTermoCiencia('COMPLEMENTACAO_SOLICITADA')).toBe(false)
  })
})

describe('proximoStatusAposAceite', () => {
  it('NAO_CONFORME devolve para EM_IMPLEMENTACAO (retrabalho)', () => {
    expect(proximoStatusAposAceite('NAO_CONFORME')).toBe('EM_IMPLEMENTACAO')
  })

  it('INTEGRAL libera a Etapa 8', () => {
    expect(proximoStatusAposAceite('INTEGRAL')).toBe('AGUARDANDO_ATUALIZACAO_DOCUMENTOS')
  })

  it('PARCIAL também libera a Etapa 8', () => {
    expect(proximoStatusAposAceite('PARCIAL')).toBe('AGUARDANDO_ATUALIZACAO_DOCUMENTOS')
  })
})

describe('formatarCodigoRecomendacao', () => {
  it('formata com zero-padding a 3 dígitos', () => {
    expect(formatarCodigoRecomendacao('12345', 2026, 1)).toBe('RT-12345-2026-001')
    expect(formatarCodigoRecomendacao('12345', 2026, 42)).toBe('RT-12345-2026-042')
  })

  it('não trunca acima de 999', () => {
    expect(formatarCodigoRecomendacao('12345', 2026, 1000)).toBe('RT-12345-2026-1000')
  })
})
