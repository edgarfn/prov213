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
  CATEGORIA_INCIDENTE:
    'Tipo do incidente, usado para organizar o histórico e identificar padrões (ex.: vários incidentes de ' +
    'phishing podem indicar necessidade de treinamento da equipe).',
  DADOS_PESSOAIS_ENVOLVIDOS:
    'Marque "sim" se o incidente pode ter exposto dados de pessoas (CPF, nome, endereço, dados de clientes ' +
    'etc.). Isso muda o que precisa ser informado e pode exigir aviso à ANPD (LGPD, Art. 48).',
  RISCOS_TITULARES:
    'Descreva o que pode acontecer com as pessoas cujos dados foram afetados (ex.: risco de golpe, ' +
    'constrangimento, discriminação) — informação exigida pela ANPD ao avaliar a gravidade do incidente.',
  CVSS_SCORE:
    'CVSS (Common Vulnerability Scoring System) é uma nota de 0 a 10 usada no mercado para medir a ' +
    'gravidade técnica de uma falha (quanto maior, mais grave). Se você tiver essa nota de um scanner ou ' +
    'relatório de pentest, o sistema sugere automaticamente a classificação de risco a partir dela.',
  ORIGEM_VULNERABILIDADE:
    'Como essa vulnerabilidade foi descoberta — ajuda a entender se seus mecanismos de detecção (scanner, ' +
    'pentest, monitoramento) estão funcionando bem.',
  STATUS_VULNERABILIDADE:
    'Em que ponto do tratamento a vulnerabilidade está: identificada (ainda não tratada), em correção, ' +
    'corrigida (resolvida), risco aceito (decisão formal de não corrigir agora) ou falso positivo (não era ' +
    'uma vulnerabilidade real).',
  RISCO_ACEITO:
    '"Risco aceito" significa que a serventia decidiu, formalmente e por escrito, conviver com essa falha ' +
    'em vez de corrigi-la agora (ex.: custo desproporcional, mitigação já suficiente por outro controle). ' +
    'Diferente de simplesmente ignorar o problema — exige justificativa registrada e é auditável.',
} as const

export type ExplicacaoLeigoChave = keyof typeof EXPLICACOES_LEIGO
