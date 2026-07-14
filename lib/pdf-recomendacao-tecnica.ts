/**
 * Dossiê consolidado da Recomendação Técnica e Decisão do Controlador —
 * documento único que renderiza progressivamente cada etapa já preenchida
 * (Recomendação, Análise de Risco, Parecer do DPO, Decisão do Controlador
 * [+ Termo de Ciência, quando aplicável], Ordem de Implementação, Relatório
 * de Execução, Termo de Aceite, Atualização de Documentos de Governança).
 *
 * Um único gerador em vez de um arquivo por documento — mesmo espírito de
 * lib/pacote-probatorio.ts (dossiê consolidado) — reaproveitando os helpers
 * de layout de lib/pdf-comunicado-incidente.ts.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const MARGIN = 50
const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89

const PRIORIDADE_LABEL: Record<string, string> = { BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto', CRITICO: 'Crítico' }
const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  COMPLEMENTACAO_SOLICITADA: 'Complementação técnica solicitada',
  AGUARDANDO_PARECER_DPO: 'Aguardando parecer do DPO',
  AGUARDANDO_DECISAO: 'Aguardando decisão do Controlador',
  REJEITADO: 'Rejeitado',
  RISCO_ACEITO_TEMPORARIO: 'Risco aceito temporariamente',
  APROVADO_AGUARDANDO_IMPLEMENTACAO: 'Aprovado — aguardando ordem de implementação',
  EM_IMPLEMENTACAO: 'Em implementação',
  AGUARDANDO_ACEITE: 'Aguardando teste e aceite',
  AGUARDANDO_ATUALIZACAO_DOCUMENTOS: 'Aguardando atualização dos documentos',
  CONCLUIDO: 'Concluído',
}
const DECISAO_LABEL: Record<string, string> = {
  APROVADO_INTEGRAL: 'Aprovado integralmente',
  APROVADO_COM_CONDICOES: 'Aprovado com condições',
  APROVADO_IMPLANTACAO_FUTURA: 'Aprovado para implantação futura',
  COMPLEMENTACAO_SOLICITADA: 'Solicitada complementação técnica',
  REJEITADO: 'Rejeitado com justificativa',
  RISCO_ACEITO_TEMPORARIO: 'Risco aceito temporariamente, com prazo corretivo',
  SUBSTITUIDO_EQUIVALENTE: 'Substituído por solução tecnicamente equivalente',
}
const RESULTADO_ACEITE_LABEL: Record<string, string> = { INTEGRAL: 'Aceite integral', PARCIAL: 'Aceite parcial', NAO_CONFORME: 'Rejeição (não conforme)' }

export interface Etapa1Data {
  situacaoAtual: string; problemaDeficiencia: string; requisitoRelacionado: string | null
  ativoAfetado: string | null; riscoNaoImplementar: string; solucaoRecomendada: string
  alternativasPossiveis: string | null; estimativaCusto: string | null; evidenciasColetadasObs: string | null
}
export interface Etapa2Data {
  probabilidadeOcorrencia: string; impactoOperacional: string; impactoDadosPessoais: string | null
  impactoAcervoRegistral: string; impactoFinanceiro: string | null; impactoJuridicoCorrecional: string | null
  controlesExistentes: string | null; controlesRecomendados: string; riscoResidualAposImplementacao: string
  consequenciaRejeicao: string; relacaoPcnPrd: string | null; relacaoRpoRto: string | null
}
export interface Etapa3Data {
  necessidadeProporcionalidade: string; dadosSensiveisEnvolvidos: string | null; novosFornecedores: string | null
  acessosRemotos: string | null; armazenamentoNuvem: string | null; transferenciaInternacional: string | null
  logsMonitoramento: string | null; retencao: string | null; contratosOperadores: string | null
  riscoTitulares: string; necessidadeRipd: boolean; necessidadeAtualizarRopa: boolean; conclusao: string
}
export interface DecisaoDetalhesData { fonteOrcamentaria: string | null; condicoesImpostas: string | null; riscoResidualConhecido: string | null }
export interface TermoCienciaData {
  fundamentoTecnico: string; consequenciasRejeicao: string; alternativasApresentadas: string | null
  motivoDeclarado: string; medidasCompensatorias: string | null
}
export interface Etapa5Data {
  escopoAprovado: string; equipamentosServicos: string | null; responsaveis: string | null; planoRollback: string
  riscosMudanca: string | null; backupAnterior: string | null; criteriosSucesso: string
  testesObrigatorios: string | null; indisponibilidadePrevista: string | null
  comunicacaoColaboradores: string | null; autorizacaoAcessoPrivilegiado: string | null
}
export interface Etapa6Data {
  relatorioTecnico: string; configuracaoAnterior: string | null; configuracaoPosterior: string | null
  usuariosExecutores: string | null; resultadosTestes: string | null; falhas: string | null; medidasCorretivas: string | null
}
export interface Etapa7Data { requisitoAtendido: string; testesRealizados: string; resultadoObtido: string; pendencias: string | null; riscoResidual: string | null }
export interface Etapa8Data {
  inventarioAtivos: boolean; diagramaRede: boolean; pcn: boolean; prd: boolean; psi: boolean; ropa: boolean
  matrizRiscos: boolean; planoBackup: boolean; dossieTecnico: boolean; outros: string | null
}

export interface RecomendacaoTecnicaDossieInput {
  codigo: string
  serventiaNome: string
  serventiaCns: string
  status: string
  prioridade: string
  classificacaoRiscoFinal: string | null
  dataIdentificacao: Date
  prazoRecomendado: Date | null
  responsavelTecnicoNome: string
  recomendacao: Etapa1Data
  analiseRisco: Etapa2Data | null
  envolveDadosPessoais: boolean
  parecerDpo: Etapa3Data | null
  parecerDpoNome: string | null
  parecerDpoConcluidoEm: Date | null
  decisao: string | null
  decisaoDetalhes: DecisaoDetalhesData | null
  decisaoControladorNome: string | null
  dataDecisao: Date | null
  valorAutorizado: number | null
  prazoImplantacao: Date | null
  termoCiencia: TermoCienciaData | null
  prazoReavaliacao: Date | null
  ordemImplementacao: Etapa5Data | null
  ordemEmitidaPorNome: string | null
  ordemEmitidaEm: Date | null
  execucao: Etapa6Data | null
  dataExecucaoRealizada: Date | null
  aceite: Etapa7Data | null
  aceiteResultado: string | null
  aceiteTecnicoNome: string | null
  aceiteControladorNome: string | null
  dataAceite: Date | null
  documentosAtualizados: Etapa8Data | null
  documentosAtualizadosEm: Date | null
}

export async function gerarRecomendacaoTecnicaDossiePdf(input: RecomendacaoTecnicaDossieInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Dossiê da Recomendação Técnica ${input.codigo} — ${input.serventiaNome}`)
  doc.setSubject('Governança de TI/LGPD — Recomendação Técnica e Decisão do Controlador')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function ensureSpace(lines: number, lineHeight = 14) {
    if (y - lines * lineHeight < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  function heading(text: string) {
    ensureSpace(2, 20)
    page.drawText(text, { x: MARGIN, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) })
    y -= 18
  }

  function wrapText(text: string, f: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (f.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
    return lines
  }

  function paragraph(label: string, value: string | null | undefined) {
    if (!value) return
    ensureSpace(2)
    const text = `${label}: ${value}`
    for (const line of wrapText(text, font, 10, PAGE_WIDTH - MARGIN * 2)) {
      ensureSpace(1)
      page.drawText(line, { x: MARGIN, y, size: 10, font })
      y -= 13
    }
  }

  function fmtData(d: Date | null): string {
    return d ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'
  }

  // ─── Cabeçalho ────────────────────────────────────────────────────────────
  page.drawText(`RECOMENDAÇÃO TÉCNICA ${input.codigo}`, { x: MARGIN, y, size: 13, font: bold })
  y -= 16
  page.drawText(input.serventiaNome, { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
  y -= 24

  heading('1. Identificação')
  paragraph('Serventia', `${input.serventiaNome} (CNS ${input.serventiaCns})`)
  paragraph('Status atual', STATUS_LABEL[input.status] ?? input.status)
  paragraph('Prioridade', PRIORIDADE_LABEL[input.prioridade] ?? input.prioridade)
  paragraph('Data de identificação', format(input.dataIdentificacao, 'dd/MM/yyyy', { locale: ptBR }))
  paragraph('Prazo recomendado', input.prazoRecomendado ? format(input.prazoRecomendado, 'dd/MM/yyyy', { locale: ptBR }) : null)
  paragraph('Responsável técnico', input.responsavelTecnicoNome)
  y -= 6

  // ─── Etapa 1 ──────────────────────────────────────────────────────────────
  heading('2. Recomendação Técnica (Etapa 1)')
  paragraph('Situação atual', input.recomendacao.situacaoAtual)
  paragraph('Problema/deficiência', input.recomendacao.problemaDeficiencia)
  paragraph('Requisito relacionado', input.recomendacao.requisitoRelacionado)
  paragraph('Sistema/ativo/processo afetado', input.recomendacao.ativoAfetado)
  paragraph('Risco de não implementar', input.recomendacao.riscoNaoImplementar)
  paragraph('Solução recomendada', input.recomendacao.solucaoRecomendada)
  paragraph('Alternativas possíveis', input.recomendacao.alternativasPossiveis)
  paragraph('Estimativa de custo', input.recomendacao.estimativaCusto)
  paragraph('Evidências coletadas (observações)', input.recomendacao.evidenciasColetadasObs)
  y -= 6

  // ─── Etapa 2 ──────────────────────────────────────────────────────────────
  if (input.analiseRisco) {
    const a = input.analiseRisco
    heading('3. Análise de Risco e Conformidade (Etapa 2)')
    paragraph('Classificação de risco final', input.classificacaoRiscoFinal ? PRIORIDADE_LABEL[input.classificacaoRiscoFinal] : null)
    paragraph('Envolve dados pessoais', input.envolveDadosPessoais ? 'Sim' : 'Não')
    paragraph('Probabilidade de ocorrência', a.probabilidadeOcorrencia)
    paragraph('Impacto operacional', a.impactoOperacional)
    paragraph('Impacto sobre dados pessoais', a.impactoDadosPessoais)
    paragraph('Impacto sobre o acervo registral', a.impactoAcervoRegistral)
    paragraph('Impacto financeiro', a.impactoFinanceiro)
    paragraph('Impacto jurídico e correicional', a.impactoJuridicoCorrecional)
    paragraph('Controles existentes', a.controlesExistentes)
    paragraph('Controles recomendados', a.controlesRecomendados)
    paragraph('Risco residual após implementação', a.riscoResidualAposImplementacao)
    paragraph('Consequência da rejeição', a.consequenciaRejeicao)
    paragraph('Relação com o PCN/PRD', a.relacaoPcnPrd)
    paragraph('Relação com o RPO/RTO', a.relacaoRpoRto)
    y -= 6
  }

  // ─── Etapa 3 ──────────────────────────────────────────────────────────────
  if (input.parecerDpo) {
    const p = input.parecerDpo
    heading('4. Parecer de Privacidade e Proteção de Dados (Etapa 3)')
    paragraph('Necessidade e proporcionalidade', p.necessidadeProporcionalidade)
    paragraph('Dados sensíveis envolvidos', p.dadosSensiveisEnvolvidos)
    paragraph('Novos fornecedores', p.novosFornecedores)
    paragraph('Acessos remotos', p.acessosRemotos)
    paragraph('Armazenamento em nuvem', p.armazenamentoNuvem)
    paragraph('Transferência internacional', p.transferenciaInternacional)
    paragraph('Logs e monitoramento', p.logsMonitoramento)
    paragraph('Retenção de dados', p.retencao)
    paragraph('Contratos com operadores/suboperadores', p.contratosOperadores)
    paragraph('Risco aos direitos dos titulares', p.riscoTitulares)
    paragraph('Necessidade de RIPD', p.necessidadeRipd ? 'Sim' : 'Não')
    paragraph('Necessidade de atualizar o ROPA', p.necessidadeAtualizarRopa ? 'Sim' : 'Não')
    paragraph('Conclusão do parecer', p.conclusao)
    paragraph('Emitido por', input.parecerDpoNome)
    paragraph('Em', fmtData(input.parecerDpoConcluidoEm))
    y -= 6
  }

  // ─── Etapa 4 ──────────────────────────────────────────────────────────────
  if (input.decisao) {
    heading('5. Decisão Formal do Controlador (Etapa 4)')
    paragraph('Decisão', DECISAO_LABEL[input.decisao] ?? input.decisao)
    paragraph('Decidido por', input.decisaoControladorNome)
    paragraph('Em', fmtData(input.dataDecisao))
    paragraph('Valor autorizado', input.valorAutorizado != null ? `R$ ${input.valorAutorizado.toFixed(2)}` : null)
    paragraph('Prazo de implantação', input.prazoImplantacao ? format(input.prazoImplantacao, 'dd/MM/yyyy', { locale: ptBR }) : null)
    if (input.decisaoDetalhes) {
      paragraph('Fonte orçamentária', input.decisaoDetalhes.fonteOrcamentaria)
      paragraph('Condições impostas', input.decisaoDetalhes.condicoesImpostas)
      paragraph('Risco residual conhecido', input.decisaoDetalhes.riscoResidualConhecido)
    }
    y -= 6

    if (input.termoCiencia) {
      heading('5.1. Termo de Ciência, Recusa e Aceitação Temporária de Risco')
      paragraph('Fundamento técnico e normativo', input.termoCiencia.fundamentoTecnico)
      paragraph('Consequências da rejeição', input.termoCiencia.consequenciasRejeicao)
      paragraph('Alternativas apresentadas', input.termoCiencia.alternativasApresentadas)
      paragraph('Motivo declarado pelo Controlador', input.termoCiencia.motivoDeclarado)
      paragraph('Medidas compensatórias', input.termoCiencia.medidasCompensatorias)
      paragraph('Prazo de reavaliação', input.prazoReavaliacao ? format(input.prazoReavaliacao, 'dd/MM/yyyy', { locale: ptBR }) : null)
      y -= 6
    }
  }

  // ─── Etapa 5 ──────────────────────────────────────────────────────────────
  if (input.ordemImplementacao) {
    const o = input.ordemImplementacao
    heading('6. Ordem de Implementação e Gestão de Mudança (Etapa 5)')
    paragraph('Escopo aprovado', o.escopoAprovado)
    paragraph('Equipamentos e serviços envolvidos', o.equipamentosServicos)
    paragraph('Responsáveis', o.responsaveis)
    paragraph('Plano de rollback', o.planoRollback)
    paragraph('Riscos da mudança', o.riscosMudanca)
    paragraph('Backup anterior à alteração', o.backupAnterior)
    paragraph('Critérios de sucesso', o.criteriosSucesso)
    paragraph('Testes obrigatórios', o.testesObrigatorios)
    paragraph('Indisponibilidade prevista', o.indisponibilidadePrevista)
    paragraph('Comunicação aos colaboradores', o.comunicacaoColaboradores)
    paragraph('Autorização de acesso privilegiado', o.autorizacaoAcessoPrivilegiado)
    paragraph('Emitida por', input.ordemEmitidaPorNome)
    paragraph('Em', fmtData(input.ordemEmitidaEm))
    y -= 6
  }

  // ─── Etapa 6 ──────────────────────────────────────────────────────────────
  if (input.execucao) {
    const e = input.execucao
    heading('7. Relatório Técnico de Implementação (Etapa 6)')
    paragraph('Data de execução', input.dataExecucaoRealizada ? format(input.dataExecucaoRealizada, 'dd/MM/yyyy', { locale: ptBR }) : null)
    paragraph('Relatório técnico', e.relatorioTecnico)
    paragraph('Configuração anterior', e.configuracaoAnterior)
    paragraph('Configuração posterior', e.configuracaoPosterior)
    paragraph('Usuários executores', e.usuariosExecutores)
    paragraph('Resultados dos testes', e.resultadosTestes)
    paragraph('Falhas encontradas', e.falhas)
    paragraph('Medidas corretivas', e.medidasCorretivas)
    y -= 6
  }

  // ─── Etapa 7 ──────────────────────────────────────────────────────────────
  if (input.aceite) {
    const a = input.aceite
    heading('8. Termo de Teste e Aceite (Etapa 7)')
    paragraph('Resultado', input.aceiteResultado ? RESULTADO_ACEITE_LABEL[input.aceiteResultado] : null)
    paragraph('Requisito atendido', a.requisitoAtendido)
    paragraph('Testes realizados', a.testesRealizados)
    paragraph('Resultado obtido', a.resultadoObtido)
    paragraph('Pendências', a.pendencias)
    paragraph('Risco residual', a.riscoResidual)
    paragraph('Técnico', input.aceiteTecnicoNome)
    paragraph('Controlador', input.aceiteControladorNome)
    paragraph('Em', fmtData(input.dataAceite))
    y -= 6
  }

  // ─── Etapa 8 ──────────────────────────────────────────────────────────────
  if (input.documentosAtualizados) {
    const d = input.documentosAtualizados
    heading('9. Atualização dos Documentos de Governança (Etapa 8)')
    const marcados = [
      d.inventarioAtivos && 'Inventário de ativos',
      d.diagramaRede && 'Diagrama de rede',
      d.pcn && 'PCN',
      d.prd && 'PRD',
      d.psi && 'Política de Segurança da Informação',
      d.ropa && 'ROPA',
      d.matrizRiscos && 'Matriz de riscos',
      d.planoBackup && 'Plano de backup',
      d.dossieTecnico && 'Dossiê técnico do Provimento 213',
    ].filter(Boolean).join(', ')
    paragraph('Documentos atualizados', marcados || 'Nenhum')
    paragraph('Outros', d.outros)
    paragraph('Em', fmtData(input.documentosAtualizadosEm))
    y -= 10
  }

  // ─── Rodapé ───────────────────────────────────────────────────────────────
  const pages = doc.getPages() as PDFPage[]
  pages.forEach((p, i) => {
    p.drawText(
      `Gerado pelo sistema de gestão de conformidade — Provimento CNJ 213/2026 · Página ${i + 1}/${pages.length}`,
      { x: MARGIN, y: 24, size: 7, font, color: rgb(0.55, 0.55, 0.55) },
    )
  })

  return doc.save()
}
