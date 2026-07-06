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
import { criarAtivo, atualizarAtivo } from '@/app/actions/ativos'
import { calcularSemaforo } from '@/lib/business-rules'
import { InfoTooltip } from '@/components/info-tooltip'
import type { Ativo, RolePapel } from '@/types/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Server, Plus, Clock, History, UserCircle, Filter, Bug, AlertTriangle, FileDown } from 'lucide-react'

const TIPO_LABEL: Record<string, string> = {
  EQUIPAMENTO: 'Equipamento',
  SISTEMA_SOFTWARE: 'Sistema/Software',
  BANCO_DADOS: 'Banco de dados',
  INTEGRACAO: 'Integração',
  CERTIFICADO_DIGITAL: 'Certificado digital',
  CONTRATO_FORNECEDOR: 'Contrato de fornecedor',
  OUTRO: 'Outro',
}

const CRITICIDADE_COR: Record<string, string> = {
  BAIXO: 'text-slate-600 border-slate-200 bg-slate-50',
  MEDIO: 'text-amber-600 border-amber-200 bg-amber-50',
  ALTO: 'text-orange-600 border-orange-200 bg-orange-50',
  CRITICO: 'text-red-700 border-red-200 bg-red-50',
}

const CRITICIDADE_LABEL: Record<string, string> = {
  BAIXO: 'Baixa', MEDIO: 'Média', ALTO: 'Alta', CRITICO: 'Crítica',
}

const STATUS_LABEL: Record<string, string> = {
  EM_AQUISICAO: 'Em aquisição',
  ATIVO: 'Ativo',
  EM_MANUTENCAO: 'Em manutenção',
  DESCONTINUADO: 'Descontinuado',
  BAIXADO: 'Baixado',
}

const VULNERABILIDADE_STATUS_LABEL: Record<string, string> = {
  IDENTIFICADA: 'Identificada',
  EM_CORRECAO: 'Em correção',
  CORRIGIDA: 'Corrigida',
  RISCO_ACEITO: 'Risco aceito',
  FALSO_POSITIVO: 'Falso positivo',
}

const TIMELINE_LABEL: Record<string, string> = {
  ATIVO_CRIADO: 'Ativo cadastrado',
  ATIVO_ATUALIZADO: 'Detalhes atualizados',
  ATIVO_BAIXADO: 'Ativo baixado',
}

function selectLabel(map: Record<string, string>) {
  return (value: unknown) => map[String(value)] ?? String(value)
}

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return ''
  return format(new Date(d), 'yyyy-MM-dd')
}

const FORM_INITIAL = {
  nome: '', tipo: 'EQUIPAMENTO', criticidade: 'MEDIO',
  fabricante: '', modelo: '', numeroSerie: '', identificadorRede: '', localizacao: '', fornecedor: '',
  descricao: '', contemDadosPessoais: false, versaoAtual: '',
  dataUltimaAtualizacao: '', dataAquisicao: '', dataEntradaProducao: '', dataFimVidaUtil: '',
  responsavelId: '_none',
}

type VulnerabilidadeResumo = {
  id: string
  descricao: string
  status: string
  classificacaoRisco: string
}

type AtivoComRelacoes = Ativo & {
  responsavel: { name: string | null; email: string } | null
  vulnerabilidades: VulnerabilidadeResumo[]
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
  ativos: AtivoComRelacoes[]
  usuarios: { id: string; name: string | null; email: string }[]
  papelAtual: RolePapel
}

export function AtivosClient({ serventiaId, ativos, usuarios, papelAtual }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<AtivoComRelacoes | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('_todos')
  const [filtroStatus, setFiltroStatus] = useState('_todos')
  const [filtroCriticidade, setFiltroCriticidade] = useState('_todos')

  // Edição do ativo selecionado
  const [eNome, setENome] = useState('')
  const [eTipo, setETipo] = useState('EQUIPAMENTO')
  const [eCriticidade, setECriticidade] = useState('MEDIO')
  const [eStatus, setEStatus] = useState('ATIVO')
  const [eFabricante, setEFabricante] = useState('')
  const [eModelo, setEModelo] = useState('')
  const [eNumeroSerie, setENumeroSerie] = useState('')
  const [eIdentificadorRede, setEIdentificadorRede] = useState('')
  const [eLocalizacao, setELocalizacao] = useState('')
  const [eFornecedor, setEFornecedor] = useState('')
  const [eDescricao, setEDescricao] = useState('')
  const [eContemDadosPessoais, setEContemDadosPessoais] = useState(false)
  const [eVersaoAtual, setEVersaoAtual] = useState('')
  const [eDataUltimaAtualizacao, setEDataUltimaAtualizacao] = useState('')
  const [eDataAquisicao, setEDataAquisicao] = useState('')
  const [eDataEntradaProducao, setEDataEntradaProducao] = useState('')
  const [eDataFimVidaUtil, setEDataFimVidaUtil] = useState('')
  const [eResponsavelId, setEResponsavelId] = useState('_none')
  const [eJustificativaBaixa, setEJustificativaBaixa] = useState('')

  // Timeline
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  function usuarioLabel(id: unknown) {
    if (id === '_none' || !id) return 'Não atribuído'
    const u = usuarios.find((x) => x.id === id)
    return u ? (u.name ?? u.email) : String(id)
  }

  function abrirDetalhe(a: AtivoComRelacoes) {
    setSelected(a)
    setENome(a.nome)
    setETipo(a.tipo)
    setECriticidade(a.criticidade)
    setEStatus(a.status)
    setEFabricante(a.fabricante ?? '')
    setEModelo(a.modelo ?? '')
    setENumeroSerie(a.numeroSerie ?? '')
    setEIdentificadorRede(a.identificadorRede ?? '')
    setELocalizacao(a.localizacao ?? '')
    setEFornecedor(a.fornecedor ?? '')
    setEDescricao(a.descricao ?? '')
    setEContemDadosPessoais(a.contemDadosPessoais)
    setEVersaoAtual(a.versaoAtual ?? '')
    setEDataUltimaAtualizacao(toDateInput(a.dataUltimaAtualizacao))
    setEDataAquisicao(toDateInput(a.dataAquisicao))
    setEDataEntradaProducao(toDateInput(a.dataEntradaProducao))
    setEDataFimVidaUtil(toDateInput(a.dataFimVidaUtil))
    setEResponsavelId(a.responsavelId ?? '_none')
    setEJustificativaBaixa(a.justificativaBaixa ?? '')
    setError(null)
    setTimeline(null)
    setTimelineLoading(true)
    fetch(`/api/ativos/${a.id}/timeline`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.entradas ?? []))
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false))
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await criarAtivo(serventiaId, fd)
      if (result.error) { setError(result.error); return }
      setCreateOpen(false)
      setForm(FORM_INITIAL)
    })
  }

  const buildDetalhesFd = useCallback(() => {
    const fd = new FormData()
    fd.append('nome', eNome)
    fd.append('tipo', eTipo)
    fd.append('criticidade', eCriticidade)
    fd.append('status', eStatus)
    fd.append('fabricante', eFabricante)
    fd.append('modelo', eModelo)
    fd.append('numeroSerie', eNumeroSerie)
    fd.append('identificadorRede', eIdentificadorRede)
    fd.append('localizacao', eLocalizacao)
    fd.append('fornecedor', eFornecedor)
    fd.append('descricao', eDescricao)
    fd.append('contemDadosPessoais', String(eContemDadosPessoais))
    fd.append('versaoAtual', eVersaoAtual)
    fd.append('dataUltimaAtualizacao', eDataUltimaAtualizacao)
    fd.append('dataAquisicao', eDataAquisicao)
    fd.append('dataEntradaProducao', eDataEntradaProducao)
    fd.append('dataFimVidaUtil', eDataFimVidaUtil)
    fd.append('responsavelId', eResponsavelId)
    fd.append('justificativaBaixa', eJustificativaBaixa)
    return fd
  }, [eNome, eTipo, eCriticidade, eStatus, eFabricante, eModelo, eNumeroSerie, eIdentificadorRede,
    eLocalizacao, eFornecedor, eDescricao, eContemDadosPessoais, eVersaoAtual, eDataUltimaAtualizacao,
    eDataAquisicao, eDataEntradaProducao, eDataFimVidaUtil, eResponsavelId, eJustificativaBaixa])

  function handleSalvar() {
    if (!selected) return
    setError(null)
    const fd = buildDetalhesFd()
    startTransition(async () => {
      const result = await atualizarAtivo(serventiaId, selected.id, fd)
      if (result.error) { setError(result.error); return }
      setSelected(null)
    })
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const emUso = ativos.filter((a) => a.status !== 'BAIXADO')
    const criticos = emUso.filter((a) => a.criticidade === 'CRITICO')
    const fimVidaUtil = emUso.filter((a) => a.dataFimVidaUtil && calcularSemaforo(a.dataFimVidaUtil) !== 'verde')
    const baixados = ativos.filter((a) => a.status === 'BAIXADO')
    return {
      total: ativos.length,
      emUso: emUso.length,
      criticos: criticos.length,
      fimVidaUtil: fimVidaUtil.length,
      baixados: baixados.length,
    }
  }, [ativos])

  const ativosFiltrados = useMemo(() => {
    return ativos.filter((a) => {
      if (filtroTipo !== '_todos' && a.tipo !== filtroTipo) return false
      if (filtroStatus !== '_todos' && a.status !== filtroStatus) return false
      if (filtroCriticidade !== '_todos' && a.criticidade !== filtroCriticidade) return false
      return true
    })
  }, [ativos, filtroTipo, filtroStatus, filtroCriticidade])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Ativos Tecnológicos</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            Anexo I; Anexo IV, Etapa 1, item 1.7 — inventário de equipamentos, sistemas, integrações,
            bancos de dados, certificados e contratos.
            <InfoTooltip chave="TIPO_ATIVO" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/ativos/exportar-pdf" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <FileDown className="h-4 w-4 mr-2" /> Exportar PDF (Requisito 1.7)
            </Button>
          </a>
          {!somenteLeitura && (
            <Button size="sm" onClick={() => { setForm(FORM_INITIAL); setError(null); setCreateOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" /> Cadastrar ativo
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total cadastrado</p>
          <p className="text-2xl font-bold">{kpis.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Em uso</p>
          <p className="text-2xl font-bold text-blue-600">{kpis.emUso}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Criticidade alta/crítica</p>
          <p className="text-2xl font-bold text-red-600">{kpis.criticos}</p>
        </CardContent></Card>
        <Card className={kpis.fimVidaUtil > 0 ? 'border-amber-200' : ''}><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Fim de vida útil próximo/vencido
            <InfoTooltip chave="FIM_VIDA_UTIL_ATIVO" />
          </p>
          <p className={`text-2xl font-bold ${kpis.fimVidaUtil > 0 ? 'text-amber-600' : ''}`}>{kpis.fimVidaUtil}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Baixados</p>
          <p className="text-2xl font-bold text-slate-500">{kpis.baixados}</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      {ativos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filtroTipo} onValueChange={(v) => v && setFiltroTipo(v)}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todos os tipos', ...TIPO_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todos os tipos</SelectItem>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={(v) => v && setFiltroStatus(v)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todos os status', ...STATUS_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroCriticidade} onValueChange={(v) => v && setFiltroCriticidade(v)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todas as criticidades', ...CRITICIDADE_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todas as criticidades</SelectItem>
              {Object.entries(CRITICIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filtroTipo !== '_todos' || filtroStatus !== '_todos' || filtroCriticidade !== '_todos') && (
            <span className="text-xs text-muted-foreground">{ativosFiltrados.length} de {ativos.length}</span>
          )}
        </div>
      )}

      {ativos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum ativo cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : ativosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum ativo corresponde aos filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {ativosFiltrados.map((a) => {
            const semaforoFimVidaUtil = a.dataFimVidaUtil && a.status !== 'BAIXADO'
              ? calcularSemaforo(a.dataFimVidaUtil)
              : null
            return (
              <Card key={a.id} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => abrirDetalhe(a)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{TIPO_LABEL[a.tipo]}</Badge>
                        <Badge variant="outline" className={`text-xs ${CRITICIDADE_COR[a.criticidade]}`}>
                          Criticidade {CRITICIDADE_LABEL[a.criticidade]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{STATUS_LABEL[a.status]}</Badge>
                        {a.contemDadosPessoais && (
                          <Badge variant="outline" className="text-xs text-purple-700 border-purple-200 bg-purple-50">
                            Dados pessoais
                          </Badge>
                        )}
                        {a.vulnerabilidades.length > 0 && (
                          <Badge variant="outline" className="text-xs text-red-700 border-red-200 bg-red-50">
                            <Bug className="h-3 w-3 mr-1" />{a.vulnerabilidades.length} vulnerabilidade(s)
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm mt-1.5">{a.nome}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {(a.fabricante || a.modelo) && (
                          <span className="text-xs text-muted-foreground">{[a.fabricante, a.modelo].filter(Boolean).join(' ')}</span>
                        )}
                        {a.localizacao && (
                          <span className="text-xs text-muted-foreground">{a.localizacao}</span>
                        )}
                        {a.responsavel && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            {a.responsavel.name ?? a.responsavel.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {semaforoFimVidaUtil && semaforoFimVidaUtil !== 'verde' && (
                      <Badge
                        className={
                          semaforoFimVidaUtil === 'vermelho' ? 'bg-red-100 text-red-700 border-red-200' :
                          'bg-amber-100 text-amber-700 border-amber-200'
                        }
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Fim de vida útil: {format(a.dataFimVidaUtil as Date, 'dd/MM/yyyy', { locale: ptBR })}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Criar */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cadastrar ativo tecnológico</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Nome/identificação *</Label>
              <Input
                placeholder="Ex.: Servidor de Arquivos - Sala Cofre"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">Tipo *<InfoTooltip chave="TIPO_ATIVO" /></Label>
                <Select value={form.tipo} onValueChange={(v) => v && setForm((p) => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue>{selectLabel(TIPO_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">Criticidade *<InfoTooltip chave="CRITICIDADE_ATIVO" /></Label>
                <Select value={form.criticidade} onValueChange={(v) => v && setForm((p) => ({ ...p, criticidade: v }))}>
                  <SelectTrigger><SelectValue>{selectLabel(CRITICIDADE_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRITICIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fabricante</Label>
                <Input value={form.fabricante} onChange={(e) => setForm((p) => ({ ...p, fabricante: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input value={form.modelo} onChange={(e) => setForm((p) => ({ ...p, modelo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nº de série/patrimônio</Label>
                <Input value={form.numeroSerie} onChange={(e) => setForm((p) => ({ ...p, numeroSerie: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>IP/hostname (se aplicável)</Label>
                <Input value={form.identificadorRede} onChange={(e) => setForm((p) => ({ ...p, identificadorRede: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Localização</Label>
                <Input placeholder="Ex.: Sala Cofre, Nuvem - AWS sa-east-1" value={form.localizacao} onChange={(e) => setForm((p) => ({ ...p, localizacao: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fornecedor/terceiro</Label>
                <Input value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Aquisição</Label>
                <Input type="date" value={form.dataAquisicao} onChange={(e) => setForm((p) => ({ ...p, dataAquisicao: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Entrada em produção</Label>
                <Input type="date" value={form.dataEntradaProducao} onChange={(e) => setForm((p) => ({ ...p, dataEntradaProducao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">Fim de vida útil/suporte<InfoTooltip chave="FIM_VIDA_UTIL_ATIVO" /></Label>
              <Input type="date" value={form.dataFimVidaUtil} onChange={(e) => setForm((p) => ({ ...p, dataFimVidaUtil: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={form.responsavelId} onValueChange={(v) => v && setForm((p) => ({ ...p, responsavelId: v }))}>
                <SelectTrigger><SelectValue>{usuarioLabel}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Não atribuído</SelectItem>
                  {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.contemDadosPessoais} onChange={(e) => setForm((p) => ({ ...p, contemDadosPessoais: e.target.checked }))} />
              Armazena ou processa dados pessoais
              <InfoTooltip chave="DADOS_PESSOAIS_ATIVO" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>Cadastrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.nome}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                <div className="space-y-1.5">
                  <Label className="text-xs">Nome/identificação</Label>
                  <Input value={eNome} onChange={(e) => setENome(e.target.value)} disabled={somenteLeitura} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={eTipo} onValueChange={(v) => v && setETipo(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{selectLabel(TIPO_LABEL)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Criticidade</Label>
                    <Select value={eCriticidade} onValueChange={(v) => v && setECriticidade(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{selectLabel(CRITICIDADE_LABEL)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CRITICIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    Status (ciclo de vida)
                    <InfoTooltip chave="STATUS_CICLO_VIDA_ATIVO" />
                  </Label>
                  <Select value={eStatus} onValueChange={(v) => v && setEStatus(v)} disabled={somenteLeitura}>
                    <SelectTrigger className="text-sm"><SelectValue>{selectLabel(STATUS_LABEL)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {eStatus === 'BAIXADO' && (
                  <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Label className="flex items-center gap-1.5 text-xs">
                      Justificativa da baixa *
                      <InfoTooltip chave="BAIXA_ATIVO" />
                    </Label>
                    <Textarea rows={2} value={eJustificativaBaixa} onChange={(e) => setEJustificativaBaixa(e.target.value)} disabled={somenteLeitura} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fabricante</Label>
                    <Input value={eFabricante} onChange={(e) => setEFabricante(e.target.value)} disabled={somenteLeitura} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo</Label>
                    <Input value={eModelo} onChange={(e) => setEModelo(e.target.value)} disabled={somenteLeitura} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nº de série/patrimônio</Label>
                    <Input value={eNumeroSerie} onChange={(e) => setENumeroSerie(e.target.value)} disabled={somenteLeitura} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">IP/hostname</Label>
                    <Input value={eIdentificadorRede} onChange={(e) => setEIdentificadorRede(e.target.value)} disabled={somenteLeitura} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Localização</Label>
                    <Input value={eLocalizacao} onChange={(e) => setELocalizacao(e.target.value)} disabled={somenteLeitura} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fornecedor/terceiro</Label>
                    <Input value={eFornecedor} onChange={(e) => setEFornecedor(e.target.value)} disabled={somenteLeitura} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea rows={2} value={eDescricao} onChange={(e) => setEDescricao(e.target.value)} disabled={somenteLeitura} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Versão atual</Label>
                    <Input value={eVersaoAtual} onChange={(e) => setEVersaoAtual(e.target.value)} disabled={somenteLeitura} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Última atualização</Label>
                    <Input type="date" value={eDataUltimaAtualizacao} onChange={(e) => setEDataUltimaAtualizacao(e.target.value)} disabled={somenteLeitura} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Aquisição</Label>
                    <Input type="date" value={eDataAquisicao} onChange={(e) => setEDataAquisicao(e.target.value)} disabled={somenteLeitura} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Entrada em produção</Label>
                    <Input type="date" value={eDataEntradaProducao} onChange={(e) => setEDataEntradaProducao(e.target.value)} disabled={somenteLeitura} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    Fim de vida útil/suporte
                    <InfoTooltip chave="FIM_VIDA_UTIL_ATIVO" />
                  </Label>
                  <Input type="date" value={eDataFimVidaUtil} onChange={(e) => setEDataFimVidaUtil(e.target.value)} disabled={somenteLeitura} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável</Label>
                  <Select value={eResponsavelId} onValueChange={(v) => v && setEResponsavelId(v)} disabled={somenteLeitura}>
                    <SelectTrigger className="text-sm"><SelectValue>{usuarioLabel}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não atribuído</SelectItem>
                      {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={eContemDadosPessoais} onChange={(e) => setEContemDadosPessoais(e.target.checked)} disabled={somenteLeitura} />
                  Armazena ou processa dados pessoais
                  <InfoTooltip chave="DADOS_PESSOAIS_ATIVO" />
                </label>

                {!somenteLeitura && (
                  <div className="flex justify-end pt-2">
                    <Button size="sm" disabled={isPending} onClick={handleSalvar}>Salvar</Button>
                  </div>
                )}

                {/* Vulnerabilidades vinculadas */}
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Bug className="h-3.5 w-3.5" /> Vulnerabilidades vinculadas
                  </Label>
                  {selected.vulnerabilidades.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma vulnerabilidade vinculada a este ativo.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {selected.vulnerabilidades.map((v) => (
                        <li key={v.id} className="text-xs flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${CRITICIDADE_COR[v.classificacaoRisco]}`}>
                            {CRITICIDADE_LABEL[v.classificacaoRisco]}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{VULNERABILIDADE_STATUS_LABEL[v.status]}</Badge>
                          <span className="flex-1 truncate">{v.descricao}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

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

                {selected.dataFimVidaUtil && selected.status !== 'BAIXADO' && calcularSemaforo(selected.dataFimVidaUtil) !== 'verde' && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      Fim de vida útil/suporte {calcularSemaforo(selected.dataFimVidaUtil) === 'vermelho' ? 'já vencido' : 'próximo'} —
                      considere planejar substituição ou renovação de suporte.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
