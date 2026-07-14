'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  CampoLeitura,
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  DECISAO_LABEL,
  RESULTADO_ACEITE_LABEL,
} from '@/components/recomendacao-tecnica-detalhe'
import { RECOMENDACAO_TECNICA_MODELO as m } from '@/lib/recomendacao-tecnica-modelo'
import { BookOpen } from 'lucide-react'

const DOC_CHECKLIST: Array<{ key: keyof typeof m.documentosAtualizados; label: string }> = [
  { key: 'inventarioAtivos', label: 'Inventário de ativos' },
  { key: 'diagramaRede', label: 'Diagrama de rede' },
  { key: 'pcn', label: 'PCN' },
  { key: 'prd', label: 'PRD' },
  { key: 'psi', label: 'Política de Segurança da Informação' },
  { key: 'ropa', label: 'ROPA' },
  { key: 'matrizRiscos', label: 'Matriz de riscos' },
  { key: 'planoBackup', label: 'Plano de backup' },
  { key: 'dossieTecnico', label: 'Dossiê técnico do Provimento 213' },
]

/**
 * Botão + Dialog com um exemplo completo, fictício, de Recomendação Técnica
 * preenchida do início ao fim — referência de consulta para quem nunca usou
 * o formulário (dados em lib/recomendacao-tecnica-modelo.ts).
 */
export function RecomendacaoTecnicaModeloButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4 mr-2" /> Modelo preenchido
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modelo preenchido — exemplo ilustrativo</DialogTitle></DialogHeader>

          <Alert>
            <AlertDescription>
              Este é um exemplo fictício mostrando como preencher cada etapa (baseado num caso real e comum:
              a falta de um segundo link de internet). Nomes, valores e datas são só ilustrativos — adapte
              tudo à realidade da sua serventia. Ele não corresponde a nenhuma recomendação de verdade.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <p className="font-mono text-sm text-muted-foreground">{m.codigo}</p>
              <h2 className="text-lg font-semibold">{m.recomendacao.problemaDeficiencia}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{PRIORIDADE_LABEL[m.prioridade]}</Badge>
                <Badge variant="outline">{STATUS_LABEL[m.status]}</Badge>
              </div>
            </div>

            <Tabs defaultValue="etapa1">
              <TabsList wrap className="gap-1">
                <TabsTrigger value="etapa1">1. Recomendação</TabsTrigger>
                <TabsTrigger value="etapa2">2. Análise de Risco</TabsTrigger>
                <TabsTrigger value="etapa3">3. Parecer DPO</TabsTrigger>
                <TabsTrigger value="etapa4">4. Decisão</TabsTrigger>
                <TabsTrigger value="etapa5">5. Ordem</TabsTrigger>
                <TabsTrigger value="etapa6">6. Execução</TabsTrigger>
                <TabsTrigger value="etapa7">7. Aceite</TabsTrigger>
                <TabsTrigger value="etapa8">8. Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="etapa1" className="space-y-3 pt-3">
                <CampoLeitura label="Situação atual" value={m.recomendacao.situacaoAtual} />
                <CampoLeitura label="Problema/deficiência" value={m.recomendacao.problemaDeficiencia} />
                <CampoLeitura label="Requisito relacionado" value={m.recomendacao.requisitoRelacionado} />
                <CampoLeitura label="Sistema/ativo/processo afetado" value={m.recomendacao.ativoAfetado} />
                <CampoLeitura label="Risco de não implementar" value={m.recomendacao.riscoNaoImplementar} />
                <CampoLeitura label="Solução recomendada" value={m.recomendacao.solucaoRecomendada} />
                <CampoLeitura label="Alternativas possíveis" value={m.recomendacao.alternativasPossiveis} />
                <CampoLeitura label="Estimativa de custo" value={m.recomendacao.estimativaCusto} />
                <CampoLeitura label="Observações sobre evidências coletadas" value={m.recomendacao.evidenciasColetadasObs} />
                <div className="grid grid-cols-1 gap-3 pt-2 text-sm sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Data de identificação</p>{m.dataIdentificacao}</div>
                  <div><p className="text-xs text-muted-foreground">Prazo recomendado</p>{m.prazoRecomendado}</div>
                  <div><p className="text-xs text-muted-foreground">Responsável técnico</p>{m.responsavelTecnicoNome}</div>
                </div>
              </TabsContent>

              <TabsContent value="etapa2" className="space-y-3 pt-3">
                <Badge variant="outline">{PRIORIDADE_LABEL[m.classificacaoRiscoFinal]}</Badge>
                <p className="text-sm">Envolve dados pessoais: {m.envolveDadosPessoais ? 'Sim' : 'Não'}</p>
                <CampoLeitura label="Probabilidade de ocorrência" value={m.analiseRisco.probabilidadeOcorrencia} />
                <CampoLeitura label="Impacto operacional" value={m.analiseRisco.impactoOperacional} />
                <CampoLeitura label="Impacto sobre dados pessoais" value={m.analiseRisco.impactoDadosPessoais} />
                <CampoLeitura label="Impacto sobre o acervo registral" value={m.analiseRisco.impactoAcervoRegistral} />
                <CampoLeitura label="Impacto financeiro" value={m.analiseRisco.impactoFinanceiro} />
                <CampoLeitura label="Impacto jurídico e correicional" value={m.analiseRisco.impactoJuridicoCorrecional} />
                <CampoLeitura label="Controles existentes" value={m.analiseRisco.controlesExistentes} />
                <CampoLeitura label="Controles recomendados" value={m.analiseRisco.controlesRecomendados} />
                <CampoLeitura label="Risco residual após implementação" value={m.analiseRisco.riscoResidualAposImplementacao} />
                <CampoLeitura label="Consequência da rejeição" value={m.analiseRisco.consequenciaRejeicao} />
                <CampoLeitura label="Relação com o PCN/PRD" value={m.analiseRisco.relacaoPcnPrd} />
                <CampoLeitura label="Relação com o RPO/RTO" value={m.analiseRisco.relacaoRpoRto} />
              </TabsContent>

              <TabsContent value="etapa3" className="space-y-3 pt-3">
                <Alert>
                  <AlertDescription>
                    Neste exemplo a Etapa 3 não se aplica: a Análise de Risco (Etapa 2) marcou &quot;não
                    envolve dados pessoais&quot;, então o Parecer do DPO é automaticamente dispensado. Ele só
                    aparece quando a mudança realmente trata dados pessoais.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="etapa4" className="space-y-3 pt-3">
                <Badge variant="outline">{DECISAO_LABEL[m.decisao]}</Badge>
                <CampoLeitura label="Fonte orçamentária" value={m.decisaoDetalhes.fonteOrcamentaria} />
                <CampoLeitura label="Condições impostas" value={m.decisaoDetalhes.condicoesImpostas} />
                <CampoLeitura label="Risco residual conhecido" value={m.decisaoDetalhes.riscoResidualConhecido} />
                <div className="grid grid-cols-1 gap-3 pt-2 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Valor autorizado</p>R$ {m.valorAutorizado.toFixed(2)}</div>
                  <div><p className="text-xs text-muted-foreground">Prazo de implantação</p>{m.prazoImplantacao}</div>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Decidido por {m.decisaoControladorNome} em {m.dataDecisao}</p>
              </TabsContent>

              <TabsContent value="etapa5" className="space-y-3 pt-3">
                <CampoLeitura label="Escopo aprovado" value={m.ordemImplementacao.escopoAprovado} />
                <CampoLeitura label="Equipamentos e serviços" value={m.ordemImplementacao.equipamentosServicos} />
                <CampoLeitura label="Responsáveis" value={m.ordemImplementacao.responsaveis} />
                <CampoLeitura label="Plano de rollback" value={m.ordemImplementacao.planoRollback} />
                <CampoLeitura label="Riscos da mudança" value={m.ordemImplementacao.riscosMudanca} />
                <CampoLeitura label="Backup anterior" value={m.ordemImplementacao.backupAnterior} />
                <CampoLeitura label="Critérios de sucesso" value={m.ordemImplementacao.criteriosSucesso} />
                <CampoLeitura label="Testes obrigatórios" value={m.ordemImplementacao.testesObrigatorios} />
                <CampoLeitura label="Indisponibilidade prevista" value={m.ordemImplementacao.indisponibilidadePrevista} />
                <CampoLeitura label="Comunicação aos colaboradores" value={m.ordemImplementacao.comunicacaoColaboradores} />
                <CampoLeitura label="Autorização de acesso privilegiado" value={m.ordemImplementacao.autorizacaoAcessoPrivilegiado} />
                <p className="text-xs text-muted-foreground pt-1">Emitida por {m.ordemEmitidaPorNome} em {m.ordemEmitidaEm}</p>
              </TabsContent>

              <TabsContent value="etapa6" className="space-y-3 pt-3">
                <CampoLeitura label="Relatório técnico" value={m.execucao.relatorioTecnico} />
                <CampoLeitura label="Configuração anterior" value={m.execucao.configuracaoAnterior} />
                <CampoLeitura label="Configuração posterior" value={m.execucao.configuracaoPosterior} />
                <CampoLeitura label="Usuários executores" value={m.execucao.usuariosExecutores} />
                <CampoLeitura label="Resultados dos testes" value={m.execucao.resultadosTestes} />
                <CampoLeitura label="Falhas encontradas" value={m.execucao.falhas} />
                <CampoLeitura label="Medidas corretivas" value={m.execucao.medidasCorretivas} />
                <p className="text-xs text-muted-foreground pt-1">Execução realizada em {m.dataExecucaoRealizada}</p>
              </TabsContent>

              <TabsContent value="etapa7" className="space-y-3 pt-3">
                <Badge variant="outline">{RESULTADO_ACEITE_LABEL[m.aceiteResultado]}</Badge>
                <CampoLeitura label="Requisito atendido" value={m.aceite.requisitoAtendido} />
                <CampoLeitura label="Testes realizados" value={m.aceite.testesRealizados} />
                <CampoLeitura label="Resultado obtido" value={m.aceite.resultadoObtido} />
                <CampoLeitura label="Pendências" value={m.aceite.pendencias} />
                <CampoLeitura label="Risco residual" value={m.aceite.riscoResidual} />
                <p className="text-xs text-muted-foreground pt-1">
                  Técnico: {m.aceiteTecnicoNome} · Controlador: {m.aceiteControladorNome} · {m.dataAceite}
                </p>
              </TabsContent>

              <TabsContent value="etapa8" className="space-y-3 pt-3">
                <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {DOC_CHECKLIST.map(({ key, label }) => (
                    <p key={key}>{m.documentosAtualizados[key] ? '✓' : '—'} {label}</p>
                  ))}
                </div>
                <CampoLeitura label="Outros" value={m.documentosAtualizados.outros} />
                <p className="text-xs text-muted-foreground pt-1">Atualizado em {m.documentosAtualizadosEm}</p>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
