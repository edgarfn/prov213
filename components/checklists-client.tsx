'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { atualizarProgresso, declaraConclusaoEtapa } from '@/app/actions/progresso'
import { EvidenciasUpload } from '@/components/evidencias-upload'
import { podeDeclaraEtapa, parametrosPorClasse } from '@/lib/business-rules'
import type { Serventia, Etapa, Requisito, ProgressoRequisito, Evidencia, RolePapel, StatusRequisito } from '@/types/prisma'
import {
  CheckCircle2,
  Circle,
  Clock,
  Minus,
  HelpCircle,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Award,
  Lock,
} from 'lucide-react'

type ReqProgresso = ProgressoRequisito & {
  evidencias: Evidencia[]
  responsavel: { name: string | null; email: string } | null
}

type ReqComProgresso = Requisito & {
  progressos: ReqProgresso[]
}

type EtapaComRequisitos = {
  id: string
  numero: number
  titulo: string
  escopo: string
  condicoesObjetivas: string
  requisitos: ReqComProgresso[]
  declaracoes: { id: string }[]
}

interface ChecklistsClientProps {
  serventia: Serventia
  etapas: EtapaComRequisitos[]
  usuarios: { id: string; name: string | null; email: string }[]
  papelAtual: RolePapel
}

const STATUS_CONFIG: Record<StatusRequisito, { icon: React.ElementType; label: string; color: string }> = {
  NAO_INICIADO: { icon: Circle, label: 'Não iniciado', color: 'text-slate-400' },
  EM_ANDAMENTO: { icon: Clock, label: 'Em andamento', color: 'text-amber-500' },
  CONCLUIDO: { icon: CheckCircle2, label: 'Concluído', color: 'text-green-500' },
  NAO_APLICAVEL: { icon: Minus, label: 'Não aplicável', color: 'text-slate-300' },
}

export function ChecklistsClient({ serventia, etapas, papelAtual }: ChecklistsClientProps) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  function toggleExpand(id: string) {
    setExpandidos((p) => ({ ...p, [id]: !p[id] }))
  }

  function calcularProgressoEtapa(etapa: EtapaComRequisitos) {
    const obrigatorios = etapa.requisitos.filter((r) => r.obrigatorio)
    const concluidos = obrigatorios.filter(
      (r) => r.progressos[0] && ['CONCLUIDO', 'NAO_APLICAVEL'].includes(r.progressos[0].status),
    )
    return { total: obrigatorios.length, concluidos: concluidos.length }
  }

  function etapaDeclarada(etapa: EtapaComRequisitos) {
    return etapa.declaracoes.length > 0
  }

  async function salvarProgresso(sid: string, rid: string, fd: FormData) {
    startTransition(async () => {
      const result = await atualizarProgresso(sid, rid, fd)
      if (result.error) {
        setMensagem({ tipo: 'erro', texto: result.error })
      } else {
        setMensagem({ tipo: 'sucesso', texto: 'Progresso atualizado!' })
        setEditing(null)
      }
      setTimeout(() => setMensagem(null), 3000)
    })
  }

  async function declararEtapa(etapaId: string) {
    startTransition(async () => {
      const result = await declaraConclusaoEtapa(serventia.id, etapaId)
      if (result.error) {
        setMensagem({ tipo: 'erro', texto: result.error })
      } else {
        setMensagem({ tipo: 'sucesso', texto: 'Etapa declarada concluída!' })
      }
      setTimeout(() => setMensagem(null), 4000)
    })
  }

  // Fonte única da regra de sequencialidade: lib/business-rules.ts::podeDeclaraEtapa
  // (a mesma função é chamada, com os mesmos parâmetros primitivos, pelo servidor
  // em app/actions/progresso.ts — aqui o resultado só controla a UI/tooltip).
  const etapasDeclaradasNumeros = etapas.filter(etapaDeclarada).map((e) => e.numero)

  function sequenciaOk(etapa: EtapaComRequisitos) {
    // isola a checagem de sequência (assume progresso concluído) para diferenciar,
    // na mensagem do tooltip, "etapa anterior pendente" de "requisitos pendentes"
    return podeDeclaraEtapa(etapa.numero, etapasDeclaradasNumeros, true)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Checklists de Conformidade</h1>
        <p className="text-muted-foreground">{serventia.nome} — {serventia.classe.replace('_', ' ')}</p>
      </div>

      {mensagem && (
        <Alert variant={mensagem.tipo === 'erro' ? 'destructive' : 'default'}>
          <AlertDescription>{mensagem.texto}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={`etapa-${etapas[0]?.id}`}>
        <TabsList className="flex-wrap h-auto gap-1">
          {etapas.map((etapa) => {
            const { total, concluidos } = calcularProgressoEtapa(etapa)
            const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0
            const declarada = etapaDeclarada(etapa)
            return (
              <TabsTrigger key={etapa.id} value={`etapa-${etapa.id}`}>
                {declarada && <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />}
                Etapa {etapa.numero}
                <Badge variant="outline" className="ml-2 text-xs">{pct}%</Badge>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {etapas.map((etapa) => {
          const { total, concluidos } = calcularProgressoEtapa(etapa)
          const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0
          const declarada = etapaDeclarada(etapa)
          const podeDeclarar_ = sequenciaOk(etapa)
          const podeDeclararBtn =
            podeDeclaraEtapa(etapa.numero, etapasDeclaradasNumeros, pct === 100) &&
            !declarada &&
            papelAtual === 'TITULAR'

          return (
            <TabsContent key={etapa.id} value={`etapa-${etapa.id}`} className="space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="font-semibold text-lg">Etapa {etapa.numero}: {etapa.titulo}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{etapa.escopo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-2xl font-bold">{pct}%</span>
                      <span className="text-xs text-muted-foreground">{concluidos}/{total} obrigatórios</span>
                    </div>
                  </div>
                  <Progress value={pct} className="mt-3 h-2" />

                  <div className="flex items-center justify-between mt-3">
                    {declarada ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Etapa Declarada Concluída
                      </Badge>
                    ) : <div />}

                    {papelAtual === 'TITULAR' && !declarada && (
                      <Tooltip>
                        {/* render=<span> evita <button> dentro de <button> — Base UI render prop */}
                        <TooltipTrigger render={<span className="inline-flex" />}>
                          <Button
                            onClick={() => declararEtapa(etapa.id)}
                            disabled={!podeDeclararBtn || isPending}
                            size="sm"
                          >
                            {!podeDeclarar_ && <Lock className="h-3 w-3 mr-1" />}
                            Declarar Conclusão
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {!podeDeclarar_
                            ? `A Etapa ${etapa.numero - 1} deve ser declarada primeiro`
                            : pct < 100
                            ? 'Conclua todos os requisitos obrigatórios primeiro'
                            : 'Declarar esta etapa como concluída'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CardContent>
              </Card>

              {etapa.requisitos.map((req) => {
                const progresso = req.progressos[0]
                const status: StatusRequisito = (progresso?.status as StatusRequisito) ?? 'NAO_INICIADO'
                const StatusIcon = STATUS_CONFIG[status].icon
                const isExpanded = expandidos[req.id]
                const isEditing = editing === req.id
                const numEvidencias = progresso?.evidencias?.length ?? 0

                return (
                  <Card key={req.id} className={declarada ? 'opacity-75' : ''}>
                    <CardHeader
                      className="cursor-pointer pb-3"
                      onClick={() => toggleExpand(req.id)}
                    >
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${STATUS_CONFIG[status].color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs font-mono">{req.codigo}</Badge>
                              <span className="font-medium text-sm">{req.titulo}</span>
                              {req.metaExcelencia && (
                                <Tooltip>
                                  <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                                    <Award className="h-4 w-4 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>Meta de Excelência</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {numEvidencias > 0 && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Paperclip className="h-3 w-3" />{numEvidencias}
                                </span>
                              )}
                              <Tooltip>
                                <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                                  <HelpCircle className="h-4 w-4 text-slate-400 hover:text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-medium mb-1">Em linguagem simples:</p>
                                  <p>{req.explicacaoLeigo}</p>
                                  <p className="text-xs mt-2 opacity-70">{req.articuloReferencia}</p>
                                </TooltipContent>
                              </Tooltip>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                status === 'CONCLUIDO' ? 'text-green-600 border-green-200 bg-green-50'
                                : status === 'EM_ANDAMENTO' ? 'text-amber-600 border-amber-200 bg-amber-50'
                                : status === 'NAO_APLICAVEL' ? 'text-slate-400 border-slate-200'
                                : 'text-slate-500 border-slate-200'
                              }`}
                            >
                              {STATUS_CONFIG[status].label}
                            </Badge>
                            {progresso?.responsavel && (
                              <span className="text-xs text-muted-foreground">
                                {progresso.responsavel.name ?? progresso.responsavel.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-4">
                        <div className="rounded-lg bg-slate-50 p-3 text-sm">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Texto da norma ({req.articuloReferencia})
                          </p>
                          <p>{req.descricaoNorma}</p>
                        </div>

                        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">
                          <p className="text-xs font-medium text-blue-700 mb-1">O que isso significa na prática?</p>
                          <p className="text-blue-900">{req.explicacaoLeigo}</p>
                        </div>

                        {req.evidenciasExigidas.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Documentos exigidos como comprovação:
                            </p>
                            <ul className="space-y-1">
                              {req.evidenciasExigidas.map((ev, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                    numEvidencias > i ? 'bg-green-500' : 'bg-slate-300'
                                  }`} />
                                  {ev}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {!somenteLeitura && !declarada && (
                          <div>
                            {isEditing ? (
                              <form
                                action={(fd) => { salvarProgresso(serventia.id, req.id, fd) }}
                                className="space-y-3 border rounded-lg p-3"
                              >
                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Status</label>
                                  <Select name="status" defaultValue={status}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NAO_INICIADO">Não iniciado</SelectItem>
                                      <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
                                      <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                                      <SelectItem value="NAO_APLICAVEL">Não aplicável</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Solução adotada</label>
                                  <Textarea
                                    name="solucaoAdotada"
                                    placeholder="Descreva como este requisito foi implementado..."
                                    defaultValue={progresso?.solucaoAdotada ?? ''}
                                    rows={3}
                                  />
                                </div>
                                {serventia.classe === 'CLASSE_1' && (
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium">
                                      Demonstração de equivalência funcional
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                      Anexo IV, item VII, &quot;c&quot; — explique por que a solução adotada
                                      atende ao requisito de forma equivalente ou superior. Usado no Relatório
                                      Simplificado da Classe 1.
                                    </p>
                                    <Textarea
                                      name="demonstracaoEquivalencia"
                                      placeholder="Ex.: o backup automatizado do provedor X cumpre o mesmo objetivo de RPO exigido..."
                                      defaultValue={progresso?.demonstracaoEquivalencia ?? ''}
                                      rows={2}
                                    />
                                  </div>
                                )}
                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Observações</label>
                                  <Textarea
                                    name="observacoes"
                                    placeholder="Notas adicionais..."
                                    defaultValue={progresso?.observacoes ?? ''}
                                    rows={2}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" disabled={isPending}>Salvar</Button>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                    Cancelar
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => setEditing(req.id)}>
                                Editar progresso
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Evidências — sempre visível quando expandido, permissões por papel */}
                        {(numEvidencias > 0 || !somenteLeitura) && (
                          <EvidenciasUpload
                            serventiaId={serventia.id}
                            requisitoId={req.id}
                            evidencias={progresso?.evidencias ?? []}
                            podeEditar={!somenteLeitura && !declarada}
                            podeExcluir={['TITULAR', 'RESPONSAVEL_TECNICO'].includes(papelAtual) && !declarada}
                            retencaoAnos={parametrosPorClasse(serventia.classe).retencaoAnos}
                          />
                        )}

                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
