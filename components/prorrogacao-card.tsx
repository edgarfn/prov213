'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { solicitarProrrogacao, decidirProrrogacao } from '@/app/actions/prorrogacao'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, CheckCircle2, XCircle, Clock } from 'lucide-react'

export interface ProrrogacaoHistorico {
  id: string
  dataOriginal: Date
  dataSolicitada: Date
  fluxo: 'SIMPLIFICADO' | 'FORMAL'
  status: 'SOLICITADA' | 'DEFERIDA' | 'INDEFERIDA'
  justificativa: string
  solicitadoPor: string
  dataSolicitacao: Date
  decididoPor: string | null
  dataDecisao: Date | null
}

interface Props {
  serventiaId: string
  classe: string
  prazoEtapas12Atual: Date
  historico: ProrrogacaoHistorico[]
  podeGerenciar: boolean
}

const STATUS_BADGE: Record<ProrrogacaoHistorico['status'], { label: string; className: string; icon: React.ElementType }> = {
  SOLICITADA: { label: 'Aguardando decisão', className: 'text-amber-700 border-amber-200 bg-amber-50', icon: Clock },
  DEFERIDA: { label: 'Deferida', className: 'text-green-700 border-green-200 bg-green-50', icon: CheckCircle2 },
  INDEFERIDA: { label: 'Indeferida', className: 'text-red-700 border-red-200 bg-red-50', icon: XCircle },
}

export function ProrrogacaoCard({ serventiaId, classe, prazoEtapas12Atual, historico, podeGerenciar }: Props) {
  const [isPending, startTransition] = useTransition()
  const [solicitarOpen, setSolicitarOpen] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [decidindo, setDecidindo] = useState<string | null>(null)
  const [decididoPor, setDecididoPor] = useState('')
  const [observacoesDecisao, setObservacoesDecisao] = useState('')

  const pendente = historico.find((p) => p.status === 'SOLICITADA')
  const deferida = historico.find((p) => p.status === 'DEFERIDA')
  const fluxo = classe === 'CLASSE_1' ? 'SIMPLIFICADO' : 'FORMAL'

  function handleSolicitar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    fd.set('dataOriginal', prazoEtapas12Atual.toISOString())
    startTransition(async () => {
      const result = await solicitarProrrogacao(serventiaId, fd)
      if (result.error) { setErro(result.error); return }
      setSolicitarOpen(false)
    })
  }

  function chamarDecisao(prorrogacaoId: string, decisao: 'DEFERIDA' | 'INDEFERIDA') {
    setErro(null)
    const fd = new FormData()
    fd.set('decisao', decisao)
    fd.set('decididoPor', decididoPor)
    fd.set('observacoesDecisao', observacoesDecisao)
    startTransition(async () => {
      const result = await decidirProrrogacao(serventiaId, prorrogacaoId, fd)
      if (result.error) { setErro(result.error); return }
      setDecidindo(null)
      setDecididoPor('')
      setObservacoesDecisao('')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-blue-600" />
          Prorrogação de Prazo (Art. 21)
        </CardTitle>
        <CardDescription>
          A Corregedoria competente pode prorrogar, uma única vez, por até 90 dias, o prazo das Etapas 1 e 2 —
          mediante plano de adequação e medidas compensatórias de mitigação de risco.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {deferida && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="font-medium text-green-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Prorrogação concedida
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Novo prazo das Etapas 1 e 2: {format(deferida.dataSolicitada, 'dd/MM/yyyy', { locale: ptBR })}
              {deferida.decididoPor && ` — decidido por ${deferida.decididoPor}`}
            </p>
          </div>
        )}

        {pendente && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="font-medium text-amber-700 flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Solicitação aguardando decisão da Corregedoria
            </p>
            <p className="text-xs text-muted-foreground">
              Nova data pedida: {format(pendente.dataSolicitada, 'dd/MM/yyyy', { locale: ptBR })} · Fluxo{' '}
              {pendente.fluxo === 'SIMPLIFICADO' ? 'simplificado (Classe 1)' : 'formal (Classes 2/3)'}
            </p>
            {podeGerenciar && (
              decidindo === pendente.id ? (
                <div className="space-y-2 border-t pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Autoridade que decidiu</Label>
                    <Input
                      value={decididoPor}
                      onChange={(e) => setDecididoPor(e.target.value)}
                      placeholder="Ex.: Corregedor-Geral da Justiça / Juiz Corregedor"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observações (opcional)</Label>
                    <Textarea
                      value={observacoesDecisao}
                      onChange={(e) => setObservacoesDecisao(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending || !decididoPor.trim()}
                      onClick={() => chamarDecisao(pendente.id, 'DEFERIDA')}
                    >
                      Registrar deferimento
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending || !decididoPor.trim()}
                      onClick={() => chamarDecisao(pendente.id, 'INDEFERIDA')}
                    >
                      Registrar indeferimento
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDecidindo(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setDecidindo(pendente.id)}>
                  Registrar decisão recebida
                </Button>
              )
            )}
          </div>
        )}

        {!pendente && !deferida && podeGerenciar && (
          <Button size="sm" onClick={() => setSolicitarOpen(true)}>
            Solicitar prorrogação
          </Button>
        )}

        {historico.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Histórico de solicitações</p>
            {historico.map((p) => {
              const cfg = STATUS_BADGE[p.status]
              const Icon = cfg.icon
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {format(p.dataSolicitacao, 'dd/MM/yyyy', { locale: ptBR })} — nova data pedida:{' '}
                    {format(p.dataSolicitada, 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                  <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                    <Icon className="h-3 w-3 mr-1" /> {cfg.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={solicitarOpen} onOpenChange={(o) => !o && setSolicitarOpen(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Solicitar prorrogação de prazo</DialogTitle></DialogHeader>
          <form onSubmit={handleSolicitar} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Prazo atual das Etapas 1 e 2: <strong>{format(prazoEtapas12Atual, 'dd/MM/yyyy', { locale: ptBR })}</strong>.
              A nova data não pode exceder 90 dias a partir desta data.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Nova data pretendida *</Label>
              <Input type="date" name="dataSolicitada" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Justificativa *</Label>
              <Textarea
                name="justificativa"
                rows={3}
                placeholder="Descreva a inviabilidade temporária de adequação (técnica ou financeira)..."
                required
              />
            </div>
            {fluxo === 'FORMAL' && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Elementos probatórios (orçamentos, providências) — obrigatório para Classes 2 e 3 *
                </Label>
                <Textarea name="elementosProbatorios" rows={2} required />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSolicitarOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="brand" disabled={isPending}>Enviar solicitação</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
