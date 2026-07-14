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
  RECOMENDACAO_TECNICA:
    'Processo formal para propor, analisar e decidir mudanças relevantes de tecnologia ou segurança. Quem ' +
    'identifica o problema (Responsável Técnico) recomenda a solução; quem decide, autoriza ou rejeita é ' +
    'sempre o Controlador de Dados (o Titular da serventia) — nunca a mesma pessoa que recomendou.',
  CODIGO_RECOMENDACAO:
    'Identificador único no formato RT-{CNS}-{ano}-{número sequencial}, ex.: RT-12345-2026-001 — gerado ' +
    'automaticamente na criação, um número por serventia a cada ano.',
  ANALISE_RISCO_CONFORMIDADE:
    'Avaliação de quão provável e quão grave seria o problema se nada fosse feito, e de como isso se ' +
    'relaciona com o Plano de Continuidade (PCN), o Plano de Recuperação (PRD) e os parâmetros de RPO/RTO ' +
    'já definidos pela serventia.',
  PARECER_PRIVACIDADE_DPO:
    'Avaliação independente do encarregado (DPO) sobre os impactos da mudança na proteção de dados pessoais ' +
    '— só é exigida quando a recomendação envolve tratamento de dados pessoais. O DPO não decide se a ' +
    'mudança será feita, só avalia os riscos de privacidade envolvidos.',
  DECISAO_CONTROLADOR:
    'Decisão formal de quem responde legalmente pela serventia (o Titular, interino ou interventor — o ' +
    '"Controlador de Dados" da LGPD). Só ele pode aprovar, rejeitar ou aceitar temporariamente o risco de ' +
    'uma recomendação técnica; uma autorização verbal ou por mensagem informal não é suficiente.',
  TERMO_CIENCIA_RISCO:
    'Documento que registra formalmente que o Controlador tomou ciência dos riscos antes de rejeitar a ' +
    'recomendação ou aceitar o risco temporariamente — evita que a decisão fique só na palavra, sem registro ' +
    'auditável do que foi decidido e por quê.',
  ORDEM_IMPLEMENTACAO:
    'Autorização formal para efetivamente executar a mudança já aprovada pelo Controlador — inclui plano de ' +
    'rollback (como desfazer se algo der errado) e critérios claros de sucesso, para que a execução não ' +
    'dependa só de combinação verbal.',
  ACEITE_RECOMENDACAO:
    'Verificação final de que a mudança implementada realmente resolveu o problema original, testada e ' +
    'assinada tanto pelo técnico responsável quanto pelo Controlador — só depois disso a recomendação é ' +
    'considerada tecnicamente encerrada.',
  ATUALIZACAO_DOCUMENTOS_GOVERNANCA:
    'Depois de qualquer mudança relevante, os documentos que descrevem a estrutura da serventia (inventário ' +
    'de ativos, diagramas, PCN, PRD, PSI, ROPA etc.) precisam refletir a nova realidade — senão eles ficam ' +
    'desatualizados e deixam de servir como prova em uma fiscalização.',
  RECOMENDACAO_RISCO_ACEITO_TEMPORARIO:
    'Diferente do "risco aceito" de uma vulnerabilidade específica, aqui o Controlador decide conviver ' +
    'temporariamente com o risco de não implementar a recomendação, com um prazo definido para reavaliar a ' +
    'decisão — não é uma aceitação permanente.',
} as const

export type ExplicacaoLeigoChave = keyof typeof EXPLICACOES_LEIGO
