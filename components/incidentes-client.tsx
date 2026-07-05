'use client'

import { useState, useTransition } from 'react'
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
import type { Incidente, RolePapel } from '@/types/prisma'
import { format, differenceInHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Plus, ShieldAlert, Clock, CheckCircle2, Send } from 'lucide-react'

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

const FORM_INITIAL = {
  titulo: '', descricao: '', dataOcorrencia: '', dataCiencia: '', gravidade: 'MEDIO',
}

interface Props {
  serventiaId: string
  incidentes: Incidente[]
  papelAtual: RolePapel
}

export function IncidentesClient({ serventiaId, incidentes, papelAtual }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Incidente | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [causaRaiz, setCausaRaiz] = useState('')
  const [medidas, setMedidas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  function abrirDetalhe(inc: Incidente) {
    setSelected(inc)
    setCausaRaiz(inc.causaRaiz ?? '')
    setMedidas(inc.medidasCorretivas ?? '')
    setError(null)
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

  function handleUpdateStatus(status: string) {
    if (!selected) return
    setError(null)
    const fd = new FormData()
    fd.append('status', status)
    fd.append('causaRaiz', causaRaiz)
    fd.append('medidasCorretivas', medidas)
    startTransition(async () => {
      const result = await atualizarIncidente(serventiaId, selected.id, fd)
      if (result.error) { setError(result.error); return }
      setSelected(null)
    })
  }

  function handleSalvarAnalise() {
    if (!selected) return
    setError(null)
    const fd = new FormData()
    fd.append('causaRaiz', causaRaiz)
    fd.append('medidasCorretivas', medidas)
    startTransition(async () => {
      const result = await atualizarIncidente(serventiaId, selected.id, fd)
      if (result.error) setError(result.error)
    })
  }

  function prazoInfo(inc: Incidente) {
    if (inc.gravidade !== 'CRITICO') return null
    const prazo = prazoIncidenteCritico(inc.dataCiencia)
    const semaforo = inc.comunicadoCorregedoria ? 'verde' : calcularSemaforo(prazo)
    const horasRestantes = differenceInHours(prazo, new Date())
    return { prazo, semaforo, horasRestantes }
  }

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

      {incidentes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum incidente registrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidentes.map((inc) => {
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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ciência em {format(inc.dataCiencia, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
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
        <DialogContent className="max-w-md">
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXO">Baixo</SelectItem>
                  <SelectItem value="MEDIO">Médio</SelectItem>
                  <SelectItem value="ALTO">Alto</SelectItem>
                  <SelectItem value="CRITICO">Crítico — aciona prazo de 72h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhe / atualização */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
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
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={handleSalvarAnalise}>Salvar análise</Button>
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
