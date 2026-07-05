/**
 * Explicações em linguagem simples para conceitos técnicos usados nos
 * módulos de Incidentes, Vulnerabilidades e Testes de Restauração — mesmo
 * espírito do campo `Requisito.explicacaoLeigo` dos Checklists, mas para
 * conceitos fixos da norma (não dados de catálogo, por isso um dicionário
 * estático em vez de uma coluna no banco).
 */
export const EXPLICACOES_LEIGO = {
  GRAVIDADE_INCIDENTE:
    'Indica o quão sério é o problema de segurança. "Crítico" é o nível mais grave — a norma exige avisar ' +
    'a Corregedoria em até 72 horas (meta de boa prática: 24 horas).',
  PRAZO_72H_INCIDENTE:
    'Contagem regressiva de 72 horas a partir do momento em que a serventia tomou conhecimento do incidente ' +
    'crítico (Art. 11, §1º). Passado esse prazo sem comunicação, o sistema mostra "vencido".',
  COMUNICADO_ANPD:
    'A ANPD (Autoridade Nacional de Proteção de Dados) deve ser avisada quando o incidente envolver dados ' +
    'pessoais e representar risco relevante aos titulares (Art. 7º, §3º da norma; LGPD).',
  CAUSA_RAIZ:
    'Explicação do que realmente causou o problema (não apenas o sintoma) — exigida para todo incidente, ' +
    'para evitar que ele se repita.',
  EXPLORACAO_ATIVA:
    'Marque "sim" se há indício de que alguém já está se aproveitando dessa falha agora. Isso reduz o prazo ' +
    'de correção de 30 dias para 72 horas.',
  PRAZO_VULNERABILIDADE:
    'Prazo máximo para corrigir a falha: 30 dias em condições normais, ou 72 horas se houver exploração ' +
    'ativa ou risco iminente (Anexo II, item 5).',
  RTO:
    'RTO (Recovery Time Objective) é o tempo máximo tolerável para o sistema voltar a funcionar depois de ' +
    'um problema. Quanto menor, mais rápido a serventia precisa se recuperar.',
  RPO:
    'RPO (Recovery Point Objective) é a quantidade máxima de dados que a serventia pode aceitar perder. Um ' +
    'RPO de 4 horas significa que, no pior caso, só se perde o que foi produzido nas últimas 4 horas.',
  CONFORMIDADE_TESTE:
    'Resultado da comparação entre o que foi medido no teste (RTO/RPO aferidos) e o que a norma exige para a ' +
    'classe da serventia. "Integral" significa que os dois parâmetros foram atendidos.',
  MEDIDAS_CORRETIVAS:
    'Providências concretas para resolver o que deu errado (ou para melhorar ainda mais) quando o teste não ' +
    'atinge conformidade integral — exigido pelo Anexo V, item 8.',
} as const

export type ExplicacaoLeigoChave = keyof typeof EXPLICACOES_LEIGO
