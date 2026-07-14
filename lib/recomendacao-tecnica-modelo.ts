/**
 * Exemplo ilustrativo, completamente fictício, de uma Recomendação Técnica
 * preenchida do início ao fim — usado só como referência de consulta para
 * quem nunca preencheu o formulário (botão "Modelo preenchido" na tela de
 * Recomendações Técnicas). Baseado no cenário de "segundo link de internet"
 * descrito no material de orientação do processo de governança de TI/LGPD.
 * Nenhum dado real de nenhuma serventia — nomes, valores e datas são exemplo.
 */
import type {
  Etapa1Data,
  Etapa2Data,
  Etapa3Data,
  DecisaoDetalhesData,
  TermoCienciaData,
  Etapa5Data,
  Etapa6Data,
  Etapa7Data,
  Etapa8Data,
} from '@/lib/pdf-recomendacao-tecnica'

export interface RecomendacaoTecnicaModeloInput {
  codigo: string
  status: string
  prioridade: string
  classificacaoRiscoFinal: string
  dataIdentificacao: string
  prazoRecomendado: string
  responsavelTecnicoNome: string
  recomendacao: Etapa1Data
  envolveDadosPessoais: boolean
  analiseRisco: Etapa2Data
  parecerDpo: Etapa3Data | null
  decisao: string
  decisaoControladorNome: string
  dataDecisao: string
  valorAutorizado: number
  prazoImplantacao: string
  decisaoDetalhes: DecisaoDetalhesData
  termoCiencia: TermoCienciaData | null
  ordemImplementacao: Etapa5Data
  ordemEmitidaPorNome: string
  ordemEmitidaEm: string
  execucao: Etapa6Data
  dataExecucaoRealizada: string
  aceite: Etapa7Data
  aceiteResultado: string
  aceiteTecnicoNome: string
  aceiteControladorNome: string
  dataAceite: string
  documentosAtualizados: Etapa8Data
  documentosAtualizadosEm: string
}

export const RECOMENDACAO_TECNICA_MODELO: RecomendacaoTecnicaModeloInput = {
  codigo: 'RT-00000-2026-001 (exemplo)',
  status: 'CONCLUIDO',
  prioridade: 'ALTO',
  classificacaoRiscoFinal: 'ALTO',
  dataIdentificacao: '15/01/2026',
  prazoRecomendado: '15/03/2026',
  responsavelTecnicoNome: 'João Silva — Responsável Técnico de TI (exemplo)',

  recomendacao: {
    situacaoAtual:
      'A serventia opera com um único link de internet (fibra óptica, operadora Exemplo Telecom), sem ' +
      'contingência automática. Não existe segundo link nem tecnologia de failover configurada.',
    problemaDeficiencia:
      'Existência de apenas um link de internet — ponto único de falha para os sistemas registrais, ' +
      'integrações eletrônicas (ONR, SAEC, CNIB, SREI) e para o backup externo.',
    requisitoRelacionado: 'Anexo I; Anexo II, item 1 — infraestrutura mínima de conectividade por classe',
    ativoAfetado: 'Conectividade de internet da serventia (link principal)',
    riscoNaoImplementar:
      'Interrupção do atendimento eletrônico, indisponibilidade das centrais (ONR/SAEC/CNIB/SREI), falha ' +
      'na sincronização de dados, descumprimento do RPO/RTO da Classe 3, impossibilidade de backup ' +
      'off-site, atraso no cumprimento de ordens judiciais e comprometimento da continuidade do serviço ' +
      'público delegado.',
    solucaoRecomendada:
      'Contratação de um segundo link de internet, de operadora e rota física distintas do link principal ' +
      '(ex.: fibra principal + rádio ou 5G empresarial de contingência), com firewall/roteador dual-WAN, ' +
      'failover automático, monitoramento de disponibilidade com alertas, testes trimestrais de failover e ' +
      'contrato empresarial com SLA.',
    alternativasPossiveis:
      'Manter apenas o link atual mediante aceitação formal do risco (não recomendado para a Classe 3); ou ' +
      'contratar apenas monitoramento reforçado sem redundância real (mitiga menos o risco).',
    estimativaCusto: 'R$ 350,00/mês (link de contingência) + R$ 1.200,00 (instalação e roteador dual-WAN)',
    evidenciasColetadasObs:
      'Print do painel do provedor mostrando link único; relatório de indisponibilidade dos últimos 6 ' +
      'meses; contrato atual sem cláusula de redundância.',
  },

  envolveDadosPessoais: false,
  analiseRisco: {
    probabilidadeOcorrencia:
      'Média-alta — a região já registrou 3 quedas de fibra nos últimos 12 meses, conforme registros da operadora.',
    impactoOperacional: 'Indisponibilidade total do atendimento eletrônico e das integrações enquanto durar a queda do link único.',
    impactoDadosPessoais:
      'Indireto — atraso na sincronização pode postergar o atendimento a titulares que exercem direitos via ' +
      'portal eletrônico, mas não há exposição ou vazamento de dados pessoais envolvido nesta mudança específica.',
    impactoAcervoRegistral:
      'Nenhum risco direto ao acervo (os dados permanecem íntegros localmente), mas o backup externo pode ' +
      'ficar comprometido durante a indisponibilidade.',
    impactoFinanceiro:
      'Baixo custo de implantação frente ao risco de sanções por descumprimento de prazos e à necessidade ' +
      'de atendimento presencial emergencial em caso de queda prolongada.',
    impactoJuridicoCorrecional:
      'Risco de apontamento em correição por descumprimento do Art. 4º/Anexo II quanto à continuidade e ' +
      'disponibilidade mínima exigida para a Classe 3.',
    controlesExistentes: 'Nenhum — não há redundância de link nem failover automático hoje.',
    controlesRecomendados: 'Segundo link com failover automático, monitoramento ativo e testes trimestrais (ver solução recomendada).',
    riscoResidualAposImplementacao:
      'Baixo — risco residual limitado a uma indisponibilidade simultânea de ambos os links (evento raro, ' +
      'mitigado por rotas e operadoras distintas).',
    consequenciaRejeicao:
      'Permanência do ponto único de falha, com risco elevado de descumprimento do RPO/RTO da Classe 3 na ' +
      'próxima indisponibilidade prolongada.',
    relacaoPcnPrd:
      'O PCN/PRD da serventia já identifica a queda de conectividade como cenário de risco relevante — esta ' +
      'recomendação implementa a medida de mitigação já prevista.',
    relacaoRpoRto:
      'O RPO de 4h e o RTO de 8h definidos para a Classe 3 dependem de sincronização e backup externo ' +
      'contínuos, hoje comprometidos durante qualquer queda do link único.',
  },

  parecerDpo: null, // Etapa 3 não se aplica — esta recomendação não envolve dados pessoais

  decisao: 'APROVADO_COM_CONDICOES',
  decisaoControladorNome: 'Maria Souza — Titular da Serventia (exemplo)',
  dataDecisao: '20/01/2026',
  valorAutorizado: 1200,
  prazoImplantacao: '15/03/2026',
  decisaoDetalhes: {
    fonteOrcamentaria: 'Verba de custeio de TI do orçamento anual da serventia',
    condicoesImpostas:
      'Contratar operadora e rota física comprovadamente distintas do link principal; apresentar relatório ' +
      'do primeiro teste de failover em até 30 dias após a instalação.',
    riscoResidualConhecido:
      'Indisponibilidade simultânea de ambos os links em caso de evento regional extremo (ex.: rompimento ' +
      'de backbone) — risco aceito como residual, a ser monitorado.',
  },
  termoCiencia: null, // só é exigido quando a decisão é "Rejeitado" ou "Risco aceito temporariamente"

  ordemImplementacao: {
    escopoAprovado: 'Instalação de segundo link de internet (operadora e rota distintas) com roteador/firewall dual-WAN e failover automático.',
    equipamentosServicos: '1 roteador dual-WAN; contrato de link empresarial com SLA; serviço de instalação da operadora.',
    responsaveis: 'Responsável Técnico de TI (execução); técnico da operadora contratada (instalação física).',
    planoRollback:
      'Manter o link atual ativo e isolado durante toda a instalação; em caso de falha na configuração do ' +
      'dual-WAN, reverter para a configuração de rede anterior, já documentada.',
    riscosMudanca: 'Indisponibilidade breve durante a reconfiguração do roteador (janela programada fora do horário de atendimento).',
    backupAnterior: 'Backup completo realizado na véspera da execução, com verificação de integridade.',
    criteriosSucesso:
      'Queda simulada do link principal resulta em comutação automática para o secundário, sem perda de ' +
      'continuidade de acesso às centrais, VPN, DNS e backup.',
    testesObrigatorios: 'Teste de failover simulando queda do link principal; verificação de velocidade mínima de 50 Mbps no link de contingência.',
    indisponibilidadePrevista: 'Janela de manutenção de 2h, fora do horário de atendimento ao público, com equipe de plantão.',
    comunicacaoColaboradores: 'Aviso interno com 48h de antecedência sobre a janela de manutenção.',
    autorizacaoAcessoPrivilegiado: 'Acesso ao roteador principal autorizado apenas ao Responsável Técnico durante a janela de manutenção, com registro de início/fim.',
  },
  ordemEmitidaPorNome: 'João Silva — Responsável Técnico de TI (exemplo)',
  ordemEmitidaEm: '25/01/2026',

  execucao: {
    relatorioTecnico:
      'Segundo link instalado com sucesso, contratado com operadora e rota física distintas do link ' +
      'principal. Roteador dual-WAN configurado com failover automático ativo.',
    configuracaoAnterior: '1 link de fibra, sem redundância, sem dual-WAN.',
    configuracaoPosterior: '2 links de operadoras distintas em dual-WAN, failover automático habilitado, monitoramento de disponibilidade com alertas por e-mail.',
    usuariosExecutores: 'Responsável Técnico de TI + técnico da operadora contratada',
    resultadosTestes: 'Queda simulada do link principal: comutação automática ocorreu em 8 segundos, sem perda de conectividade das centrais/VPN/backup.',
    falhas: 'Nenhuma falha registrada durante a execução.',
    medidasCorretivas: 'Não aplicável — execução dentro do planejado.',
  },
  dataExecucaoRealizada: '10/02/2026',

  aceite: {
    requisitoAtendido: 'Eliminação do ponto único de falha na conectividade de internet, em conformidade com o Anexo II, item 1.',
    testesRealizados: 'Três simulações de queda do link principal em dias distintos, com verificação de comutação automática, continuidade de VPN/DNS/backup e tempo de recuperação.',
    resultadoObtido: 'Comutação automática bem-sucedida nas três simulações, com tempo médio de recuperação de 9 segundos — dentro do esperado.',
    pendencias: 'Nenhuma.',
    riscoResidual: 'Indisponibilidade simultânea de ambos os links em evento regional extremo (residual, monitorado).',
  },
  aceiteResultado: 'INTEGRAL',
  aceiteTecnicoNome: 'João Silva — Responsável Técnico de TI (exemplo)',
  aceiteControladorNome: 'Maria Souza — Titular da Serventia (exemplo)',
  dataAceite: '15/02/2026',

  documentosAtualizados: {
    inventarioAtivos: true,
    diagramaRede: true,
    pcn: true,
    prd: true,
    psi: false,
    ropa: false,
    matrizRiscos: true,
    planoBackup: true,
    dossieTecnico: true,
    outros: 'Contrato do novo link arquivado no repositório de fornecedores.',
  },
  documentosAtualizadosEm: '20/02/2026',
}
