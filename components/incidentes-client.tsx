'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  criarIncidente,
  atualizarIncidente,
  comunicarCorregedoria,
  comunicarAnpd,
} from '@/app/actions/incidentes'
import { prazoIncidenteCritico, calcularSemaforo } from '@/lib/business-rules'
import { InfoTooltip } from '@/components/info-tooltip'
import { EvidenciasUpload } from '@/components/evidencias-upload'
import type { Incidente, Evidencia, RolePapel } from '@/types/prisma'
import { format, differenceInHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle, Plus, ShieldAlert, Clock, CheckCircle2, Send,
  FileDown, History, UserCircle, Filter,
} from 'lucide-react'

const GRAVIDADE_COR: Record<string, string> = {
  BAIXO: 'text-slate-600 border-slate-200 bg-slate-50',
  MEDIO: 'text-amber-600 border-amber-200 bg-amber-50',
  ALTO: 'text-orange-600 border-orange-200 bg-orange-50',
  CRITICO: 'text-red-700 border-red-200 bg-red-50',
}

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_TRATAMENTO: 'Em tratamento',
  ENCERRADO: 'Encerrado',
}

const GRAVIDADE_LABEL: Record<string, string> = {
  BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto', CRITICO: 'Crítico',
}

const SIM_NAO_LABEL: Record<string, string> = { true: 'Sim', false: 'Não' }

// Base UI só resolve o rótulo do valor selecionado a partir dos <SelectItem>
// já montados no DOM (isto é, depois que o dropdown foi aberto ao menos uma
// vez) — sem isso, o gatilho fechado mostra o valor bruto (ex.: "MEDIO" em
// vez de "Médio"). Passar a função de mapeamento como children resolve o
// rótulo imediatamente, sem depender da montagem do popup.
function selectLabel(map: Record<string, string>) {
  return (value: unknown) => map[String(value)] ?? String(value)
}

const CATEGORIA_LABEL: Record<string, string> = {
  ACESSO_NAO_AUTORIZADO: 'Acesso não autorizado',
  MALWARE_RANSOMWARE: 'Malware/Ransomware',
  VAZAMENTO_DADOS: 'Vazamento de dados',
  INDISPONIBILIDADE_DOS: 'Indisponibilidade/DoS',
  PHISHING_ENGENHARIA_SOCIAL: 'Phishing/Engenharia social',
  FALHA_CONFIGURACAO: 'Falha de configuração',
  PERDA_ROUBO_DISPOSITIVO: 'Perda/roubo de dispositivo',
  FISICO: 'Incidente físico',
  OUTRO: 'Outro',
}

const TIMELINE_LABEL: Record<string, string> = {
  INCIDENTE_CRIADO: 'Incidente registrado',
  INCIDENTE_ATUALIZADO: 'Detalhes atualizados',
  INCIDENTE_COMUNICADO_CORREGEDORIA: 'Comunicado à Corregedoria marcado',
  INCIDENTE_COMUNICADO_ANPD: 'Comunicado à ANPD marcado',
  INCIDENTE_COMUNICADO_GERADO: 'PDF de comunicado gerado',
  INCIDENTE_ENCERRADO: 'Incidente encerrado',
  EVIDENCIA_UPLOAD: 'Evidência anexada',
  EVIDENCIA_EXCLUIDA: 'Evidência excluída',
}

const FORM_INITIAL = {
  titulo: '', descricao: '', categoria: 'OUTRO', dataOcorrencia: '', dataCiencia: '', gravidade: 'MEDIO',
  responsavelId: '_none', dadosPessoaisEnvolvidos: 'false',
  categoriasDadosAfetados: '', quantidadeTitularesAfetados: '', riscosTitulares: '',
}

type IncidenteComRelacoes = Incidente & {
  responsavel: { name: string | null; email: string } | null
  evidencias: Evidencia[]
}

interface TimelineEntry {
  id: string
  acao: string
  userEmail?: string | null
  userName?: string | null
  timestamp: string
}

interface Props {
  serventiaId: string
  incidentes: IncidenteComRelacoes[]
  usuarios: { id: string; name: string | null; email: string }[]
  papelAtual: RolePapel
  retencaoAnos: number
}

export function IncidentesClient({ serventiaId, incidentes, usuarios, papelAtual, retencaoAnos }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<IncidenteComRelacoes | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  // Filtros da lista
  const [filtroStatus, setFiltroStatus] = useState('_todos')
  const [filtroGravidade, setFiltroGravidade] = useState('_todos')

  // Edição do incidente selecionado
  const [causaRaiz, setCausaRaiz] = useState('')
  const [medidas, setMedidas] = useState('')
  const [categoria, setCategoria] = useState('OUTRO')
  const [responsavelId, setResponsavelId] = useState('_none')
  const [dadosPessoaisEnvolvidos, setDadosPessoaisEnvolvidos] = useState(false)
  const [categoriasDadosAfetados, setCategoriasDadosAfetados] = useState('')
  const [quantidadeTitularesAfetados, setQuantidadeTitularesAfetados] = useState('')
  const [riscosTitulares, setRiscosTitulares] = useState('')

  // Timeline do incidente selecionado
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  function abrirDetalhe(inc: IncidenteComRelacoes) {
    setSelected(inc)
    setCausaRaiz(inc.causaRaiz ?? '')
    setMedidas(inc.medidasCorretivas ?? '')
    setCategoria(inc.categoria)
    setResponsavelId(inc.responsavelId ?? '_none')
    setDadosPessoaisEnvolvidos(inc.dadosPessoaisEnvolvidos)
    setCategoriasDadosAfetados(inc.categoriasDadosAfetados ?? '')
    setQuantidadeTitularesAfetados(inc.quantidadeTitularesAfetados?.toString() ?? '')
    setRiscosTitulares(inc.riscosTitulares ?? '')
    setError(null)
    setTimeline(null)
    setTimelineLoading(true)
    fetch(`/api/incidentes/${inc.id}/timeline`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.entradas ?? []))
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false))
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    startTransition(async () => {
      const result = await criarIncidente(serventiaId, fd)
      if (result.error) { setError(result.error); return }
      setCreateOpen(false)
      setForm(FORM_INITIAL)
    })
  }

  const buildDetalhesFd = useCallback((extra?: Record<string, string>) => {
    const fd = new FormData()
    fd.append('causaRaiz', causaRaiz)
    fd.append('medidasCorretivas', medidas)
    fd.append('categoria', categoria)
    fd.append('responsavelId', responsavelId)
    fd.append('dadosPessoaisEnvolvidos', String(dadosPessoaisEnvolvidos))
    fd.append('categoriasDadosAfetados', categoriasDadosAfetados)
    fd.append('quantidadeTitularesAfetados', quantidadeTitularesAfetados)
    fd.append('riscosTitulares', riscosTitulares)
    if (extra) Object.entries(extra).forEach(([k, v]) => fd.append(k, v))
    return fd
  }, [causaRaiz, medidas, categoria, responsavelId, dadosPessoaisEnvolvidos, categoriasDadosAfetados, quantidadeTitularesAfetados, riscosTitulares])

  function handleUpdateStatus(status: string) {
    if (!selected) return
    setError(null)
    const fd = buildDetalhesFd({ status })
    startTransition(async () => {
      const result = await atualizarIncidente(serventiaId, selected.id, fd)
      if (result.error) { setError(result.error); return }
      setSelected(null)
    })
  }

  function handleSalvarDetalhes() {
    if (!selected) return
    setError(null)
    const fd = buildDetalhesFd()
    startTransition(async () => {
      const result = await atualizarIncidente(serventiaId, selected.id, fd)
      if (result.error) setError(result.error)
    })
  }

  function usuarioLabel(id: unknown) {
    if (id === '_none' || !id) return 'Não atribuído'
    const u = usuarios.find((x) => x.id === id)
    return u ? (u.name ?? u.email) : String(id)
  }

  function prazoInfo(inc: Incidente) {
    if (inc.gravidade !== 'CRITICO') return null
    const prazo = prazoIncidenteCritico(inc.dataCiencia)
    const semaforo = inc.comunicadoCorregedoria ? 'verde' : calcularSemaforo(prazo)
    const horasRestantes = differenceInHours(prazo, new Date())
    return { prazo, semaforo, horasRestantes }
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const abertos = incidentes.filter((i) => i.status !== 'ENCERRADO')
    const criticosVencendoOuVencidos = incidentes.filter((i) => {
      if (i.status === 'ENCERRADO' || i.comunicadoCorregedoria || i.gravidade !== 'CRITICO') return false
      const p = prazoInfo(i)
      return p ? p.semaforo !== 'verde' : false
    })
    const encerrados = incidentes.filter((i) => i.status === 'ENCERRADO')
    return {
      total: incidentes.length,
      abertos: abertos.length,
      criticosAtencao: criticosVencendoOuVencidos.length,
      encerrados: encerrados.length,
    }
  }, [incidentes])

  // ─── Filtros ────────────────────────────────────────────────────────────────
  const incidentesFiltrados = useMemo(() => {
    return incidentes.filter((i) => {
      if (filtroStatus !== '_todos' && i.status !== filtroStatus) return false
      if (filtroGravidade !== '_todos' && i.gravidade !== filtroGravidade) return false
      return true
    })
  }, [incidentes, filtroStatus, filtroGravidade])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incidentes de Segurança</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Art. 11 — incidentes críticos exigem comunicação à Corregedoria em até 72h (meta de 24h).
          </p>
        </div>
        {!somenteLeitura && (
          <Button size="sm" onClick={() => { setForm(FORM_INITIAL); setError(null); setCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Registrar incidente
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{kpis.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Em aberto</p>
          <p className="text-2xl font-bold text-amber-600">{kpis.abertos}</p>
        </CardContent></Card>
        <Card className={kpis.criticosAtencao > 0 ? 'border-red-200' : ''}><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Críticos exigindo atenção (72h)</p>
          <p className={`text-2xl font-bold ${kpis.criticosAtencao > 0 ? 'text-red-600' : ''}`}>{kpis.criticosAtencao}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Encerrados</p>
          <p className="text-2xl font-bold text-green-600">{kpis.encerrados}</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      {incidentes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filtroStatus} onValueChange={(v) => v && setFiltroStatus(v)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todos os status', ...STATUS_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todos os status</SelectItem>
              <SelectItem value="ABERTO">Aberto</SelectItem>
              <SelectItem value="EM_TRATAMENTO">Em tratamento</SelectItem>
              <SelectItem value="ENCERRADO">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroGravidade} onValueChange={(v) => v && setFiltroGravidade(v)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todas as gravidades', ...GRAVIDADE_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todas as gravidades</SelectItem>
              <SelectItem value="BAIXO">Baixo</SelectItem>
              <SelectItem value="MEDIO">Médio</SelectItem>
              <SelectItem value="ALTO">Alto</SelectItem>
              <SelectItem value="CRITICO">Crítico</SelectItem>
            </SelectContent>
          </Select>
          {(filtroStatus !== '_todos' || filtroGravidade !== '_todos') && (
            <span className="text-xs text-muted-foreground">{incidentesFiltrados.length} de {incidentes.length}</span>
          )}
        </div>
      )}

      {incidentes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum incidente registrado.</p>
          </CardContent>
        </Card>
      ) : incidentesFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum incidente corresponde aos filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidentesFiltrados.map((inc) => {
            const prazo = prazoInfo(inc)
            return (
              <Card
                key={inc.id}
                className="cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => abrirDetalhe(inc)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${GRAVIDADE_COR[inc.gravidade]}`}>{inc.gravidade}</Badge>
                        <Badge variant="outline" className="text-xs">{STATUS_LABEL[inc.status]}</Badge>
                        <Badge variant="outline" className="text-xs text-slate-500">{CATEGORIA_LABEL[inc.categoria]}</Badge>
                        {inc.dadosPessoaisEnvolvidos && (
                          <Badge variant="outline" className="text-xs text-purple-600 border-purple-200 bg-purple-50">
                            Dados pessoais
                          </Badge>
                        )}
                        {inc.comunicadoCorregedoria && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Corregedoria comunicada
                          </Badge>
                        )}
                        {inc.comunicadoAnpd && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                            ANPD comunicada
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm mt-1.5">{inc.titulo}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          Ciência em {format(inc.dataCiencia, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                        {inc.responsavel && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            {inc.responsavel.name ?? inc.responsavel.email}
                          </span>
                        )}
                        {inc.evidencias.length > 0 && (
                          <span className="text-xs text-muted-foreground">{inc.evidencias.length} evidência(s)</span>
                        )}
                      </div>
                    </div>
                    {prazo && inc.status !== 'ENCERRADO' && !inc.comunicadoCorregedoria && (
                      <Badge
                        className={
                          prazo.semaforo === 'vermelho' ? 'bg-red-100 text-red-700 border-red-200' :
                          prazo.semaforo === 'amarelo' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-green-100 text-green-700 border-green-200'
                        }
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {prazo.horasRestantes < 0 ? 'Prazo de 72h vencido' : `${prazo.horasRestantes}h para comunicar (72h)`}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Criar incidente */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar incidente de segurança</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Categoria
                <InfoTooltip chave="CATEGORIA_INCIDENTE" />
              </Label>
              <Select value={form.categoria} onValueChange={(v) => v && setForm((p) => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue>{selectLabel(CATEGORIA_LABEL)}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de ocorrência *</Label>
                <Input type="datetime-local" value={form.dataOcorrencia} onChange={(e) => setForm((p) => ({ ...p, dataOcorrencia: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Data de ciência *</Label>
                <Input type="datetime-local" value={form.dataCiencia} onChange={(e) => setForm((p) => ({ ...p, dataCiencia: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Gravidade *
                <InfoTooltip chave="GRAVIDADE_INCIDENTE" />
              </Label>
              <Select value={form.gravidade} onValueChange={(v) => v && setForm((p) => ({ ...p, gravidade: v }))}>
                <SelectTrigger><SelectValue>{selectLabel(GRAVIDADE_LABEL)}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXO">Baixo</SelectItem>
                  <SelectItem value="MEDIO">Médio</SelectItem>
                  <SelectItem value="ALTO">Alto</SelectItem>
                  <SelectItem value="CRITICO">Crítico — aciona prazo de 72h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável pelo tratamento</Label>
              <Select value={form.responsavelId} onValueChange={(v) => v && setForm((p) => ({ ...p, responsavelId: v }))}>
                <SelectTrigger><SelectValue>{usuarioLabel}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Não atribuído</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Dados pessoais envolvidos?
                <InfoTooltip chave="DADOS_PESSOAIS_ENVOLVIDOS" />
              </Label>
              <Select
                value={form.dadosPessoaisEnvolvidos}
                onValueChange={(v) => v && setForm((p) => ({ ...p, dadosPessoaisEnvolvidos: v }))}
              >
                <SelectTrigger><SelectValue>{selectLabel(SIM_NAO_LABEL)}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Não</SelectItem>
                  <SelectItem value="true">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.dadosPessoaisEnvolvidos === 'true' && (
              <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categorias de dados afetados</Label>
                  <Input
                    placeholder="Ex.: CPF, nome completo, endereço"
                    value={form.categoriasDadosAfetados}
                    onChange={(e) => setForm((p) => ({ ...p, categoriasDadosAfetados: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantidade estimada de titulares afetados</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.quantidadeTitularesAfetados}
                    onChange={(e) => setForm((p) => ({ ...p, quantidadeTitularesAfetados: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhe / atualização */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.titulo}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <p className="text-muted-foreground">{selected.descricao}</p>

                {selected.gravidade === 'CRITICO' && (
                  <Alert className={selected.comunicadoCorregedoria ? '' : 'border-red-200 bg-red-50'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-start gap-1.5">
                      <span>
                        Prazo-limite de comunicação à Corregedoria: {format(prazoIncidenteCritico(selected.dataCiencia), 'dd/MM/yyyy HH:mm', { locale: ptBR })} (Art. 11, §1º — 72h)
                      </span>
                      <InfoTooltip chave="PRAZO_72H_INCIDENTE" className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600 cursor-help flex-shrink-0 mt-0.5" />
                    </AlertDescription>
                  </Alert>
                )}

                {!somenteLeitura && (
                  <div className="flex flex-wrap gap-2">
                    {!selected.comunicadoCorregedoria && (
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => startTransition(async () => {
                        const r = await comunicarCorregedoria(serventiaId, selected.id)
                        if (r.error) setError(r.error); else setSelected({ ...selected, comunicadoCorregedoria: true, dataComunicacao: new Date() })
                      })}>
                        <Send className="h-3.5 w-3.5 mr-1.5" /> Marcar comunicado à Corregedoria
                      </Button>
                    )}
                    {!selected.comunicadoAnpd && (
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => startTransition(async () => {
                        const r = await comunicarAnpd(serventiaId, selected.id)
                        if (r.error) setError(r.error); else setSelected({ ...selected, comunicadoAnpd: true })
                      })}>
                        Marcar comunicado à ANPD (dados pessoais)
                      </Button>
                    )}
                    <InfoTooltip chave="COMUNICADO_ANPD" />
                  </div>
                )}

                {/* Geração de comunicado formal em PDF */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => window.open(`/api/incidentes/${selected.id}/comunicado?destino=CORREGEDORIA`, '_blank')}
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1.5" /> Gerar comunicado (Corregedoria)
                  </Button>
                  {selected.dadosPessoaisEnvolvidos && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => window.open(`/api/incidentes/${selected.id}/comunicado?destino=ANPD`, '_blank')}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> Gerar comunicado (ANPD)
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      Categoria
                      <InfoTooltip chave="CATEGORIA_INCIDENTE" />
                    </Label>
                    <Select value={categoria} onValueChange={(v) => v && setCategoria(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{selectLabel(CATEGORIA_LABEL)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Responsável</Label>
                    <Select value={responsavelId} onValueChange={(v) => v && setResponsavelId(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{usuarioLabel}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Não atribuído</SelectItem>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Dados pessoais envolvidos?
                    <InfoTooltip chave="DADOS_PESSOAIS_ENVOLVIDOS" />
                  </Label>
                  <Select
                    value={dadosPessoaisEnvolvidos ? 'true' : 'false'}
                    onValueChange={(v) => v && setDadosPessoaisEnvolvidos(v === 'true')}
                    disabled={somenteLeitura}
                  >
                    <SelectTrigger><SelectValue>{selectLabel(SIM_NAO_LABEL)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Não</SelectItem>
                      <SelectItem value="true">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dadosPessoaisEnvolvidos && (
                  <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categorias de dados afetados</Label>
                      <Input
                        placeholder="Ex.: CPF, nome completo, endereço"
                        value={categoriasDadosAfetados}
                        onChange={(e) => setCategoriasDadosAfetados(e.target.value)}
                        disabled={somenteLeitura}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantidade estimada de titulares afetados</Label>
                      <Input
                        type="number"
                        min={0}
                        value={quantidadeTitularesAfetados}
                        onChange={(e) => setQuantidadeTitularesAfetados(e.target.value)}
                        disabled={somenteLeitura}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        Riscos aos titulares
                        <InfoTooltip chave="RISCOS_TITULARES" />
                      </Label>
                      <Textarea
                        rows={2}
                        value={riscosTitulares}
                        onChange={(e) => setRiscosTitulares(e.target.value)}
                        disabled={somenteLeitura}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Análise de causa raiz
                    <InfoTooltip chave="CAUSA_RAIZ" />
                  </Label>
                  <Textarea rows={2} value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} disabled={somenteLeitura} />
                </div>
                <div className="space-y-1.5">
                  <Label>Medidas corretivas</Label>
                  <Textarea rows={2} value={medidas} onChange={(e) => setMedidas(e.target.value)} disabled={somenteLeitura} />
                </div>

                {!somenteLeitura && (
                  <div className="flex justify-between pt-2">
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={handleSalvarDetalhes}>Salvar</Button>
                    <div className="flex gap-2">
                      {selected.status !== 'EM_TRATAMENTO' && selected.status !== 'ENCERRADO' && (
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleUpdateStatus('EM_TRATAMENTO')}>Em tratamento</Button>
                      )}
                      {selected.status !== 'ENCERRADO' && (
                        <Button size="sm" disabled={isPending} onClick={() => handleUpdateStatus('ENCERRADO')}>Encerrar incidente</Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Evidências */}
                <EvidenciasUpload
                  serventiaId={serventiaId}
                  incidenteId={selected.id}
                  evidencias={selected.evidencias}
                  podeEditar={!somenteLeitura}
                  podeExcluir={['TITULAR', 'RESPONSAVEL_TECNICO'].includes(papelAtual)}
                  retencaoAnos={retencaoAnos}
                />

                {/* Linha do tempo */}
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <History className="h-3.5 w-3.5" /> Histórico
                  </Label>
                  {timelineLoading ? (
                    <p className="text-xs text-muted-foreground">Carregando…</p>
                  ) : !timeline || timeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                      {timeline.map((t) => (
                        <li key={t.id} className="text-xs flex items-start gap-2">
                          <span className="text-muted-foreground flex-shrink-0 w-28">
                            {format(new Date(t.timestamp), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </span>
                          <span className="flex-1">
                            {TIMELINE_LABEL[t.acao] ?? t.acao}
                            {(t.userName || t.userEmail) && (
                              <span className="text-muted-foreground"> — {t.userName ?? t.userEmail}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
