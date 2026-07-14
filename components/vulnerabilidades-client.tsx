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
import { criarVulnerabilidade, atualizarVulnerabilidade } from '@/app/actions/vulnerabilidades'
import { calcularSemaforo, classificacaoRiscoPorCvss } from '@/lib/business-rules'
import { InfoTooltip } from '@/components/info-tooltip'
import { EvidenciasUpload } from '@/components/evidencias-upload'
import type { Vulnerabilidade, Evidencia, RolePapel } from '@/types/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bug, Plus, Clock, Zap, History, UserCircle, Filter, ShieldOff } from 'lucide-react'

const CLASSIFICACAO_COR: Record<string, string> = {
  BAIXO: 'text-slate-600 border-slate-200 bg-slate-50',
  MEDIO: 'text-amber-600 border-amber-200 bg-amber-50',
  ALTO: 'text-orange-600 border-orange-200 bg-orange-50',
  CRITICO: 'text-red-700 border-red-200 bg-red-50',
}

const CLASSIFICACAO_LABEL: Record<string, string> = {
  BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto', CRITICO: 'Crítico',
}

const STATUS_LABEL: Record<string, string> = {
  IDENTIFICADA: 'Identificada',
  EM_CORRECAO: 'Em correção',
  CORRIGIDA: 'Corrigida',
  RISCO_ACEITO: 'Risco aceito',
  FALSO_POSITIVO: 'Falso positivo',
}

const STATUS_TERMINAIS = ['CORRIGIDA', 'RISCO_ACEITO', 'FALSO_POSITIVO']

const ORIGEM_LABEL: Record<string, string> = {
  PENTESTE: 'Pentest',
  SCANNER_AUTOMATIZADO: 'Scanner automatizado',
  REPORTE_INTERNO: 'Reporte interno',
  REPORTE_EXTERNO: 'Reporte externo',
  AUDITORIA: 'Auditoria',
  FORNECEDOR_CVE: 'Fornecedor/CVE público',
  OUTRO: 'Outro',
}

const TIMELINE_LABEL: Record<string, string> = {
  VULNERABILIDADE_CRIADA: 'Vulnerabilidade registrada',
  VULNERABILIDADE_ATUALIZADA: 'Detalhes atualizados',
  VULNERABILIDADE_ENCERRADA: 'Vulnerabilidade encerrada',
  EVIDENCIA_UPLOAD: 'Evidência anexada',
  EVIDENCIA_EXCLUIDA: 'Evidência excluída',
}

function selectLabel(map: Record<string, string>) {
  return (value: unknown) => map[String(value)] ?? String(value)
}

const FORM_INITIAL = {
  descricao: '', dataIdentificacao: '', classificacaoRisco: 'ALTO', origem: 'OUTRO',
  ativoAfetado: '', cveReferencia: '', cvssScore: '', responsavelId: '_none', exploracaoAtiva: false,
}

type VulnerabilidadeComRelacoes = Vulnerabilidade & {
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
  vulnerabilidades: VulnerabilidadeComRelacoes[]
  usuarios: { id: string; name: string | null; email: string }[]
  papelAtual: RolePapel
  retencaoAnos: number
}

export function VulnerabilidadesClient({ serventiaId, vulnerabilidades, usuarios, papelAtual, retencaoAnos }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<VulnerabilidadeComRelacoes | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('_todos')
  const [filtroClassificacao, setFiltroClassificacao] = useState('_todos')

  // Edição da vulnerabilidade selecionada
  const [status, setStatus] = useState('IDENTIFICADA')
  const [classificacaoRisco, setClassificacaoRisco] = useState('ALTO')
  const [origem, setOrigem] = useState('OUTRO')
  const [ativoAfetado, setAtivoAfetado] = useState('')
  const [cveReferencia, setCveReferencia] = useState('')
  const [cvssScore, setCvssScore] = useState('')
  const [responsavelId, setResponsavelId] = useState('_none')
  const [exploracaoAtiva, setExploracaoAtiva] = useState(false)
  const [providencias, setProvidencias] = useState('')
  const [justificativaRiscoAceito, setJustificativaRiscoAceito] = useState('')

  // Timeline
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  function usuarioLabel(id: unknown) {
    if (id === '_none' || !id) return 'Não atribuído'
    const u = usuarios.find((x) => x.id === id)
    return u ? (u.name ?? u.email) : String(id)
  }

  function abrirDetalhe(v: VulnerabilidadeComRelacoes) {
    setSelected(v)
    setStatus(v.status)
    setClassificacaoRisco(v.classificacaoRisco)
    setOrigem(v.origem)
    setAtivoAfetado(v.ativoAfetado ?? '')
    setCveReferencia(v.cveReferencia ?? '')
    setCvssScore(v.cvssScore?.toString() ?? '')
    setResponsavelId(v.responsavelId ?? '_none')
    setExploracaoAtiva(v.exploracaoAtiva)
    setProvidencias(v.providencias ?? '')
    setJustificativaRiscoAceito(v.justificativaRiscoAceito ?? '')
    setError(null)
    setTimeline(null)
    setTimelineLoading(true)
    fetch(`/api/vulnerabilidades/${v.id}/timeline`)
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
      const result = await criarVulnerabilidade(serventiaId, fd)
      if (result.error) { setError(result.error); return }
      setCreateOpen(false)
      setForm(FORM_INITIAL)
    })
  }

  const buildDetalhesFd = useCallback((extra?: Record<string, string>) => {
    const fd = new FormData()
    fd.append('status', status)
    fd.append('classificacaoRisco', classificacaoRisco)
    fd.append('origem', origem)
    fd.append('ativoAfetado', ativoAfetado)
    fd.append('cveReferencia', cveReferencia)
    fd.append('cvssScore', cvssScore)
    fd.append('responsavelId', responsavelId)
    fd.append('exploracaoAtiva', String(exploracaoAtiva))
    fd.append('providencias', providencias)
    fd.append('justificativaRiscoAceito', justificativaRiscoAceito)
    if (extra) Object.entries(extra).forEach(([k, v]) => fd.append(k, v))
    return fd
  }, [status, classificacaoRisco, origem, ativoAfetado, cveReferencia, cvssScore, responsavelId, exploracaoAtiva, providencias, justificativaRiscoAceito])

  function handleSalvar() {
    if (!selected) return
    setError(null)
    const fd = buildDetalhesFd()
    startTransition(async () => {
      const result = await atualizarVulnerabilidade(serventiaId, selected.id, fd)
      if (result.error) { setError(result.error); return }
      setSelected(null)
    })
  }

  function aplicarSugestaoCvss(valor: string, setClassif: (v: string) => void) {
    const n = Number(valor)
    if (valor.trim() && Number.isFinite(n)) {
      setClassif(classificacaoRiscoPorCvss(n))
    }
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const abertas = vulnerabilidades.filter((v) => !STATUS_TERMINAIS.includes(v.status))
    const atencao = abertas.filter((v) => calcularSemaforo(v.prazoLimite) !== 'verde')
    const corrigidas = vulnerabilidades.filter((v) => v.status === 'CORRIGIDA')
    const riscoAceito = vulnerabilidades.filter((v) => v.status === 'RISCO_ACEITO')
    return {
      total: vulnerabilidades.length,
      abertas: abertas.length,
      atencao: atencao.length,
      corrigidas: corrigidas.length,
      riscoAceito: riscoAceito.length,
    }
  }, [vulnerabilidades])

  const vulnerabilidadesFiltradas = useMemo(() => {
    return vulnerabilidades.filter((v) => {
      if (filtroStatus !== '_todos' && v.status !== filtroStatus) return false
      if (filtroClassificacao !== '_todos' && v.classificacaoRisco !== filtroClassificacao) return false
      return true
    })
  }, [vulnerabilidades, filtroStatus, filtroClassificacao])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Vulnerabilidades</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Anexo II, item 5 — críticas em até 30 dias; exploração ativa ou risco iminente, em até 72h.
          </p>
        </div>
        {!somenteLeitura && (
          <Button size="sm" onClick={() => { setForm(FORM_INITIAL); setError(null); setCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Registrar vulnerabilidade
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{kpis.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Em aberto</p>
          <p className="text-2xl font-bold text-amber-600">{kpis.abertas}</p>
        </CardContent></Card>
        <Card className={kpis.atencao > 0 ? 'border-red-200' : ''}><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Exigindo atenção (prazo)</p>
          <p className={`text-2xl font-bold ${kpis.atencao > 0 ? 'text-red-600' : ''}`}>{kpis.atencao}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Corrigidas</p>
          <p className="text-2xl font-bold text-green-600">{kpis.corrigidas}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Risco aceito</p>
          <p className="text-2xl font-bold text-purple-600">{kpis.riscoAceito}</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      {vulnerabilidades.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filtroStatus} onValueChange={(v) => v && setFiltroStatus(v)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todos os status', ...STATUS_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroClassificacao} onValueChange={(v) => v && setFiltroClassificacao(v)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todas as classificações', ...CLASSIFICACAO_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todas as classificações</SelectItem>
              {Object.entries(CLASSIFICACAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filtroStatus !== '_todos' || filtroClassificacao !== '_todos') && (
            <span className="text-xs text-muted-foreground">{vulnerabilidadesFiltradas.length} de {vulnerabilidades.length}</span>
          )}
        </div>
      )}

      {vulnerabilidades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bug className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma vulnerabilidade registrada.</p>
          </CardContent>
        </Card>
      ) : vulnerabilidadesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhuma vulnerabilidade corresponde aos filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vulnerabilidadesFiltradas.map((v) => {
            const encerrada = STATUS_TERMINAIS.includes(v.status)
            const semaforo = encerrada ? 'verde' : calcularSemaforo(v.prazoLimite)
            return (
              <Card key={v.id} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => abrirDetalhe(v)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${CLASSIFICACAO_COR[v.classificacaoRisco]}`}>
                          {CLASSIFICACAO_LABEL[v.classificacaoRisco]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{STATUS_LABEL[v.status]}</Badge>
                        <Badge variant="outline" className="text-xs text-slate-500">{ORIGEM_LABEL[v.origem]}</Badge>
                        {v.cveReferencia && (
                          <Badge variant="outline" className="text-xs font-mono text-slate-500">{v.cveReferencia}</Badge>
                        )}
                        {v.exploracaoAtiva && (
                          <Badge variant="outline" className="text-xs text-red-700 border-red-200 bg-red-50">
                            <Zap className="h-3 w-3 mr-1" />Exploração ativa
                          </Badge>
                        )}
                        {v.status === 'RISCO_ACEITO' && (
                          <Badge variant="outline" className="text-xs text-purple-700 border-purple-200 bg-purple-50">
                            <ShieldOff className="h-3 w-3 mr-1" />Risco aceito
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm mt-1.5">{v.descricao}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          Identificada em {format(v.dataIdentificacao, 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                        {v.ativoAfetado && (
                          <span className="text-xs text-muted-foreground">Ativo: {v.ativoAfetado}</span>
                        )}
                        {v.responsavel && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            {v.responsavel.name ?? v.responsavel.email}
                          </span>
                        )}
                        {v.evidencias.length > 0 && (
                          <span className="text-xs text-muted-foreground">{v.evidencias.length} evidência(s)</span>
                        )}
                      </div>
                    </div>
                    {!encerrada && (
                      <Badge
                        className={
                          semaforo === 'vermelho' ? 'bg-red-100 text-red-700 border-red-200' :
                          semaforo === 'amarelo' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-green-100 text-green-700 border-green-200'
                        }
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Prazo: {format(v.prazoLimite, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar vulnerabilidade</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição *</Label>
                <Textarea rows={3} value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Data de identificação *</Label>
                <Input type="date" value={form.dataIdentificacao} onChange={(e) => setForm((p) => ({ ...p, dataIdentificacao: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select value={form.origem} onValueChange={(v) => v && setForm((p) => ({ ...p, origem: v }))}>
                  <SelectTrigger><SelectValue>{selectLabel(ORIGEM_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORIGEM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Nota CVSS (0-10)
                  <InfoTooltip chave="CVSS_SCORE" />
                </Label>
                <Input
                  type="number" min={0} max={10} step={0.1}
                  value={form.cvssScore}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, cvssScore: e.target.value }))
                    aplicarSugestaoCvss(e.target.value, (c) => setForm((p) => ({ ...p, classificacaoRisco: c })))
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CVE (opcional)</Label>
                <Input placeholder="CVE-2025-12345" value={form.cveReferencia} onChange={(e) => setForm((p) => ({ ...p, cveReferencia: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Classificação de risco *</Label>
                <Select value={form.classificacaoRisco} onValueChange={(v) => v && setForm((p) => ({ ...p, classificacaoRisco: v }))}>
                  <SelectTrigger><SelectValue>{selectLabel(CLASSIFICACAO_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLASSIFICACAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ativo/sistema afetado</Label>
                <Input
                  placeholder="Ex.: Servidor de e-mail, Portal do cliente"
                  value={form.ativoAfetado}
                  onChange={(e) => setForm((p) => ({ ...p, ativoAfetado: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Responsável pela correção</Label>
                <Select value={form.responsavelId} onValueChange={(v) => v && setForm((p) => ({ ...p, responsavelId: v }))}>
                  <SelectTrigger><SelectValue>{usuarioLabel}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Não atribuído</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.exploracaoAtiva} onChange={(e) => setForm((p) => ({ ...p, exploracaoAtiva: e.target.checked }))} />
                Há evidência de exploração ativa ou risco iminente (prazo cai para 72h)
                <InfoTooltip chave="EXPLORACAO_ATIVA" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="brand" disabled={isPending}>Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{CLASSIFICACAO_LABEL[selected.classificacaoRisco]} — {selected.descricao.slice(0, 60)}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <p className="text-muted-foreground">{selected.descricao}</p>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span>
                    Prazo-limite: {format(selected.prazoLimite, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    {selected.exploracaoAtiva ? ' (72h — exploração ativa)' : ' (30 dias — sem exploração ativa)'}
                  </span>
                  <InfoTooltip chave="PRAZO_VULNERABILIDADE" className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600 cursor-help flex-shrink-0 mt-0.5" />
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Classificação de risco</Label>
                    <Select value={classificacaoRisco} onValueChange={(v) => v && setClassificacaoRisco(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{selectLabel(CLASSIFICACAO_LABEL)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CLASSIFICACAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      Status
                      <InfoTooltip chave="STATUS_VULNERABILIDADE" />
                    </Label>
                    <Select value={status} onValueChange={(v) => v && setStatus(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{selectLabel(STATUS_LABEL)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Origem</Label>
                    <Select value={origem} onValueChange={(v) => v && setOrigem(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{selectLabel(ORIGEM_LABEL)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORIGEM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Responsável</Label>
                    <Select value={responsavelId} onValueChange={(v) => v && setResponsavelId(v)} disabled={somenteLeitura}>
                      <SelectTrigger className="text-sm"><SelectValue>{usuarioLabel}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Não atribuído</SelectItem>
                        {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      Nota CVSS
                      <InfoTooltip chave="CVSS_SCORE" />
                    </Label>
                    <Input
                      type="number" min={0} max={10} step={0.1}
                      value={cvssScore}
                      disabled={somenteLeitura}
                      onChange={(e) => {
                        setCvssScore(e.target.value)
                        aplicarSugestaoCvss(e.target.value, setClassificacaoRisco)
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CVE</Label>
                    <Input placeholder="CVE-2025-12345" value={cveReferencia} onChange={(e) => setCveReferencia(e.target.value)} disabled={somenteLeitura} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Ativo/sistema afetado</Label>
                    <Input value={ativoAfetado} onChange={(e) => setAtivoAfetado(e.target.value)} disabled={somenteLeitura} />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={exploracaoAtiva} onChange={(e) => setExploracaoAtiva(e.target.checked)} disabled={somenteLeitura} />
                    Há evidência de exploração ativa ou risco iminente (prazo cai para 72h)
                    <InfoTooltip chave="EXPLORACAO_ATIVA" />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <Label>Providências adotadas</Label>
                  <Textarea rows={3} value={providencias} onChange={(e) => setProvidencias(e.target.value)} disabled={somenteLeitura} />
                </div>

                {status === 'RISCO_ACEITO' && (
                  <div className="space-y-1.5 rounded-lg border border-purple-100 bg-purple-50 p-3">
                    <Label className="flex items-center gap-1.5 text-xs">
                      Justificativa do aceite de risco *
                      <InfoTooltip chave="RISCO_ACEITO" />
                    </Label>
                    <Textarea
                      rows={2}
                      value={justificativaRiscoAceito}
                      onChange={(e) => setJustificativaRiscoAceito(e.target.value)}
                      disabled={somenteLeitura}
                    />
                  </div>
                )}

                {!somenteLeitura && (
                  <div className="flex justify-end pt-2">
                    <Button size="sm" variant="brand" disabled={isPending} onClick={handleSalvar}>Salvar</Button>
                  </div>
                )}

                {/* Evidências */}
                <EvidenciasUpload
                  serventiaId={serventiaId}
                  vulnerabilidadeId={selected.id}
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
