'use client'

import { useMemo, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { criarRecomendacao } from '@/app/actions/recomendacao-tecnica'
import { RecomendacaoTecnicaDetalhe, type RecomendacaoComRelacoes } from '@/components/recomendacao-tecnica-detalhe'
import { RecomendacaoTecnicaModeloButton } from '@/components/recomendacao-tecnica-modelo'
import { InfoTooltip } from '@/components/info-tooltip'
import type { RolePapel } from '@/types/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, Plus, Filter } from 'lucide-react'

const PRIORIDADE_LABEL: Record<string, string> = { BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto', CRITICO: 'Crítico' }
const PRIORIDADE_COR: Record<string, string> = {
  BAIXO: 'text-slate-600 border-slate-200 bg-slate-50',
  MEDIO: 'text-amber-600 border-amber-200 bg-amber-50',
  ALTO: 'text-orange-600 border-orange-200 bg-orange-50',
  CRITICO: 'text-red-700 border-red-200 bg-red-50',
}
const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  COMPLEMENTACAO_SOLICITADA: 'Complementação solicitada',
  AGUARDANDO_PARECER_DPO: 'Aguardando parecer DPO',
  AGUARDANDO_DECISAO: 'Aguardando decisão',
  REJEITADO: 'Rejeitado',
  RISCO_ACEITO_TEMPORARIO: 'Risco aceito temporariamente',
  APROVADO_AGUARDANDO_IMPLEMENTACAO: 'Aprovado — aguardando implementação',
  EM_IMPLEMENTACAO: 'Em implementação',
  AGUARDANDO_ACEITE: 'Aguardando aceite',
  AGUARDANDO_ATUALIZACAO_DOCUMENTOS: 'Aguardando atualização de documentos',
  CONCLUIDO: 'Concluído',
}
const STATUS_TERMINAIS_POSITIVOS = ['CONCLUIDO']
const STATUS_TERMINAIS_NEGATIVOS = ['REJEITADO', 'RISCO_ACEITO_TEMPORARIO']

function selectLabel(map: Record<string, string>) {
  return (value: unknown) => map[String(value)] ?? String(value)
}

const FORM_INITIAL = {
  dataIdentificacao: '', prazoRecomendado: '', prioridade: 'ALTO', responsavelTecnicoId: '',
  situacaoAtual: '', problemaDeficiencia: '', requisitoRelacionado: '', ativoAfetado: '',
  riscoNaoImplementar: '', solucaoRecomendada: '', alternativasPossiveis: '', estimativaCusto: '', evidenciasColetadasObs: '',
}

interface MembroResumo { id: string; name: string | null; email: string; papel: string }

interface Props {
  serventiaId: string
  recomendacoes: RecomendacaoComRelacoes[]
  membros: MembroResumo[]
  papelAtual: RolePapel
  existeDpo: boolean
  existeTitular: boolean
  retencaoAnos: number
}

export function RecomendacoesTecnicasClient({ serventiaId, recomendacoes, membros, papelAtual, existeDpo, existeTitular, retencaoAnos }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  const [filtroStatus, setFiltroStatus] = useState('_todos')

  const selected = recomendacoes.find((r) => r.id === selectedId) ?? null

  const kpis = useMemo(() => {
    const aguardandoDecisao = recomendacoes.filter((r) => r.status === 'AGUARDANDO_DECISAO').length
    const aguardandoParecerDpo = recomendacoes.filter((r) => r.status === 'AGUARDANDO_PARECER_DPO').length
    const concluidas = recomendacoes.filter((r) => STATUS_TERMINAIS_POSITIVOS.includes(r.status)).length
    const emAndamento = recomendacoes.filter(
      (r) => !STATUS_TERMINAIS_POSITIVOS.includes(r.status) && !STATUS_TERMINAIS_NEGATIVOS.includes(r.status),
    ).length
    return { total: recomendacoes.length, aguardandoDecisao, aguardandoParecerDpo, concluidas, emAndamento }
  }, [recomendacoes])

  const recomendacoesFiltradas = useMemo(() => {
    if (filtroStatus === '_todos') return recomendacoes
    return recomendacoes.filter((r) => r.status === filtroStatus)
  }, [recomendacoes, filtroStatus])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await criarRecomendacao(serventiaId, fd)
      if (result.error) { setError(result.error); return }
      setCreateOpen(false)
      setForm(FORM_INITIAL)
      if (result.id) setSelectedId(result.id)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recomendações Técnicas e Decisão do Controlador</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            Governança de mudanças de TI/LGPD: recomendação, análise de risco, parecer do DPO e decisão formal do Controlador.
            <InfoTooltip chave="RECOMENDACAO_TECNICA" />
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <RecomendacaoTecnicaModeloButton />
          {!somenteLeitura && (
            <Button size="sm" onClick={() => { setForm({ ...FORM_INITIAL, responsavelTecnicoId: membros[0]?.id ?? '' }); setError(null); setCreateOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" /> Nova recomendação
            </Button>
          )}
        </div>
      </div>

      {!existeTitular && (
        <Alert variant="destructive">
          <AlertDescription>Nenhum membro com papel Titular está designado nesta serventia — a Decisão do Controlador (Etapa 4) não poderá ser registrada até que um seja designado em Configurações → Usuários.</AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{kpis.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Em andamento</p>
          <p className="text-2xl font-bold text-blue-600">{kpis.emAndamento}</p>
        </CardContent></Card>
        <Card className={kpis.aguardandoDecisao > 0 ? 'border-amber-200' : ''}><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Aguardando decisão</p>
          <p className={`text-2xl font-bold ${kpis.aguardandoDecisao > 0 ? 'text-amber-600' : ''}`}>{kpis.aguardandoDecisao}</p>
        </CardContent></Card>
        <Card className={kpis.aguardandoParecerDpo > 0 ? 'border-amber-200' : ''}><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Aguardando parecer DPO</p>
          <p className={`text-2xl font-bold ${kpis.aguardandoParecerDpo > 0 ? 'text-amber-600' : ''}`}>{kpis.aguardandoParecerDpo}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Concluídas</p>
          <p className="text-2xl font-bold text-green-600">{kpis.concluidas}</p>
        </CardContent></Card>
      </div>

      {/* Filtro */}
      {recomendacoes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filtroStatus} onValueChange={(v) => v && setFiltroStatus(v)}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue>{selectLabel({ _todos: 'Todos os status', ...STATUS_LABEL })}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {filtroStatus !== '_todos' && (
            <span className="text-xs text-muted-foreground">{recomendacoesFiltradas.length} de {recomendacoes.length}</span>
          )}
        </div>
      )}

      {/* Lista */}
      {recomendacoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma recomendação técnica registrada.</p>
          </CardContent>
        </Card>
      ) : recomendacoesFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhuma recomendação corresponde ao filtro selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recomendacoesFiltradas.map((r) => {
            const dados1 = r.recomendacao as unknown as { problemaDeficiencia: string }
            return (
              <Card key={r.id} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setSelectedId(r.id)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{r.codigo}</span>
                        <Badge variant="outline" className={`text-xs ${PRIORIDADE_COR[r.prioridade]}`}>{PRIORIDADE_LABEL[r.prioridade]}</Badge>
                        <Badge variant="outline" className="text-xs">{STATUS_LABEL[r.status]}</Badge>
                      </div>
                      <p className="font-medium text-sm mt-1.5">{dados1.problemaDeficiencia}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Identificada em {format(r.dataIdentificacao, 'dd/MM/yyyy', { locale: ptBR })} · Responsável técnico: {r.responsavelTecnico?.name ?? r.responsavelTecnico?.email}
                      </p>
                    </div>
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
          <DialogHeader><DialogTitle>Nova Recomendação Técnica</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data de identificação *</Label>
                <Input type="date" value={form.dataIdentificacao} onChange={(e) => setForm((p) => ({ ...p, dataIdentificacao: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo recomendado</Label>
                <Input type="date" value={form.prazoRecomendado} onChange={(e) => setForm((p) => ({ ...p, prazoRecomendado: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Prioridade *</Label>
                <Select value={form.prioridade} onValueChange={(v) => v && setForm((p) => ({ ...p, prioridade: v }))}>
                  <SelectTrigger><SelectValue>{selectLabel(PRIORIDADE_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Responsável técnico *</Label>
                <Select value={form.responsavelTecnicoId} onValueChange={(v) => v && setForm((p) => ({ ...p, responsavelTecnicoId: v }))}>
                  <SelectTrigger><SelectValue>{(v: unknown) => membros.find((m) => m.id === v)?.name ?? 'Selecione'}</SelectValue></SelectTrigger>
                  <SelectContent>{membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Situação atual *</Label>
              <Textarea rows={2} value={form.situacaoAtual} onChange={(e) => setForm((p) => ({ ...p, situacaoAtual: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Problema ou deficiência encontrada *</Label>
              <Textarea rows={2} value={form.problemaDeficiencia} onChange={(e) => setForm((p) => ({ ...p, problemaDeficiencia: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Requisito legal/técnico relacionado</Label>
              <Input value={form.requisitoRelacionado} onChange={(e) => setForm((p) => ({ ...p, requisitoRelacionado: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Sistema/ativo/processo afetado</Label>
              <Input value={form.ativoAfetado} onChange={(e) => setForm((p) => ({ ...p, ativoAfetado: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Risco de não implementar *</Label>
              <Textarea rows={2} value={form.riscoNaoImplementar} onChange={(e) => setForm((p) => ({ ...p, riscoNaoImplementar: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Solução recomendada *</Label>
              <Textarea rows={2} value={form.solucaoRecomendada} onChange={(e) => setForm((p) => ({ ...p, solucaoRecomendada: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Alternativas possíveis</Label>
              <Textarea rows={2} value={form.alternativasPossiveis} onChange={(e) => setForm((p) => ({ ...p, alternativasPossiveis: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Estimativa de custo</Label>
              <Input value={form.estimativaCusto} onChange={(e) => setForm((p) => ({ ...p, estimativaCusto: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações sobre evidências já coletadas</Label>
              <Textarea rows={2} value={form.evidenciasColetadasObs} onChange={(e) => setForm((p) => ({ ...p, evidenciasColetadasObs: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="brand" disabled={isPending || !form.responsavelTecnicoId}>Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <RecomendacaoTecnicaDetalhe
              serventiaId={serventiaId}
              recomendacao={selected}
              membros={membros}
              papelAtual={papelAtual}
              existeDpo={existeDpo}
              retencaoAnos={retencaoAnos}
              onClose={() => setSelectedId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
