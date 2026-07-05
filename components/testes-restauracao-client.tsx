'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { criarTesteRestauracao, atualizarMedidasCorretivas } from '@/app/actions/testes-restauracao'
import { calcularSemaforo, proximoTesteRestauracaoDevido } from '@/lib/business-rules'
import { EvidenciasUpload } from '@/components/evidencias-upload'
import { InfoTooltip } from '@/components/info-tooltip'
import type { TesteRestauracao, RolePapel, Evidencia } from '@/types/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  HardDriveDownload, Plus, FileDown, Clock, CheckCircle2, AlertOctagon,
  ChevronDown, ChevronRight,
} from 'lucide-react'

const CONFORMIDADE_COR: Record<string, string> = {
  INTEGRAL: 'text-green-700 border-green-200 bg-green-50',
  PARCIAL: 'text-amber-700 border-amber-200 bg-amber-50',
  NAO_CONFORME: 'text-red-700 border-red-200 bg-red-50',
}

const CONFORMIDADE_LABEL: Record<string, string> = {
  INTEGRAL: 'Conformidade integral',
  PARCIAL: 'Conformidade parcial',
  NAO_CONFORME: 'Não conforme',
}

type TesteComEvidencias = TesteRestauracao & { evidencias: Evidencia[] }

interface Props {
  serventiaId: string
  testes: TesteComEvidencias[]
  papelAtual: RolePapel
  rtoDefinido: number
  rpoDefinido: number
  periodicidadeMeses: number
  retencaoAnos: number
}

const FORM_INITIAL = {
  dataTeste: '', sistemasRestaurados: '', rtoAferido: '', rpoAferido: '',
}

export function TestesRestauracaoClient({
  serventiaId, testes, papelAtual, rtoDefinido, rpoDefinido, periodicidadeMeses, retencaoAnos,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(FORM_INITIAL)
  const [participantes, setParticipantes] = useState([{ nome: '', papel: 'Responsável técnico interno' }])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  const [expandido, setExpandido] = useState<string | null>(null)
  const [medidas, setMedidas] = useState<Record<string, string>>({})
  const [salvandoMedidas, setSalvandoMedidas] = useState<string | null>(null)

  function toggleExpand(id: string, medidasAtuais: string | null) {
    setExpandido((prev) => (prev === id ? null : id))
    setMedidas((prev) => (prev[id] !== undefined ? prev : { ...prev, [id]: medidasAtuais ?? '' }))
  }

  function salvarMedidas(testeId: string) {
    setSalvandoMedidas(testeId)
    startTransition(async () => {
      await atualizarMedidasCorretivas(serventiaId, testeId, medidas[testeId] ?? '')
      setSalvandoMedidas(null)
    })
  }

  const ultimoTeste = testes[0]
  const proximoDevido = proximoTesteRestauracaoDevido(ultimoTeste?.dataTeste ?? null, periodicidadeMeses)
  const semaforoProximo = proximoDevido ? calcularSemaforo(proximoDevido) : null

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.append('dataTeste', form.dataTeste)
    fd.append('sistemasRestaurados', form.sistemasRestaurados)
    fd.append('rtoDefinido', String(rtoDefinido))
    fd.append('rtoAferido', form.rtoAferido)
    fd.append('rpoDefinido', String(rpoDefinido))
    fd.append('rpoAferido', form.rpoAferido)
    fd.append('participantes', JSON.stringify(participantes.filter((p) => p.nome.trim())))
    startTransition(async () => {
      const result = await criarTesteRestauracao(serventiaId, fd)
      if (result.error) { setError(result.error); return }
      setCreateOpen(false)
      setForm(FORM_INITIAL)
      setParticipantes([{ nome: '', papel: 'Responsável técnico interno' }])
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Testes de Restauração</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Art. 12, §9º; Anexo V — periodicidade de {periodicidadeMeses === 6 ? 'semestral' : 'anual'} para a classe da serventia.
            RTO ≤ {rtoDefinido}h · RPO ≤ {rpoDefinido}h.
          </p>
        </div>
        {!somenteLeitura && (
          <Button size="sm" onClick={() => { setForm(FORM_INITIAL); setError(null); setCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Registrar teste
          </Button>
        )}
      </div>

      {proximoDevido && semaforoProximo && (
        <Alert className={semaforoProximo === 'vermelho' ? 'border-red-200 bg-red-50' : semaforoProximo === 'amarelo' ? 'border-amber-200 bg-amber-50' : ''}>
          <AlertOctagon className="h-4 w-4" />
          <AlertDescription>
            Próximo teste de restauração devido até {format(proximoDevido, 'dd/MM/yyyy', { locale: ptBR })}
            {semaforoProximo === 'vermelho' && ' — prazo vencido.'}
          </AlertDescription>
        </Alert>
      )}

      {testes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <HardDriveDownload className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum teste de restauração registrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {testes.map((t) => {
            const aberto = expandido === t.id
            return (
              <Card key={t.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => toggleExpand(t.id, t.medidasCorretivas)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {aberto ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                        <Badge variant="outline" className={`text-xs ${CONFORMIDADE_COR[t.conformidade]}`}>
                          {t.conformidade === 'INTEGRAL' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                          {CONFORMIDADE_LABEL[t.conformidade]}
                        </Badge>
                        <InfoTooltip chave="CONFORMIDADE_TESTE" />
                        <span className="text-xs text-muted-foreground">
                          {format(t.dataTeste, 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        {t.evidencias.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {t.evidencias.length} evidência(s)
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1.5">
                        {t.sistemasRestaurados.join(', ') || 'Sistemas não especificados'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <span>RTO aferido: {t.rtoAferido}h (máx. {t.rtoDefinido}h)</span>
                        <InfoTooltip chave="RTO" />
                        <span>· RPO aferido: {t.rpoAferido}h (máx. {t.rpoDefinido}h)</span>
                        <InfoTooltip chave="RPO" />
                      </p>
                    </button>
                    <a href={`/api/testes-restauracao/${t.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        <FileDown className="h-3.5 w-3.5 mr-1.5" /> Ata (Anexo V)
                      </Button>
                    </a>
                  </div>

                  {aberto && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          Medidas corretivas (Anexo V, item 8) — providências deliberadas quando a conformidade não é integral
                          <InfoTooltip chave="MEDIDAS_CORRETIVAS" />
                        </Label>
                        {!somenteLeitura ? (
                          <>
                            <Textarea
                              rows={3}
                              value={medidas[t.id] ?? ''}
                              onChange={(e) => setMedidas((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              placeholder="Descreva as medidas corretivas ou preventivas deliberadas, responsável e prazo..."
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={salvandoMedidas === t.id}
                              onClick={() => salvarMedidas(t.id)}
                            >
                              {salvandoMedidas === t.id ? 'Salvando...' : 'Salvar medidas corretivas'}
                            </Button>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {t.medidasCorretivas?.trim() || 'Nenhuma medida corretiva registrada.'}
                          </p>
                        )}
                      </div>

                      <EvidenciasUpload
                        serventiaId={serventiaId}
                        testeRestauracaoId={t.id}
                        evidencias={t.evidencias}
                        podeEditar={!somenteLeitura}
                        podeExcluir={['TITULAR', 'RESPONSAVEL_TECNICO'].includes(papelAtual)}
                        retencaoAnos={retencaoAnos}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar teste de restauração</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Data do teste *</Label>
              <Input type="datetime-local" value={form.dataTeste} onChange={(e) => setForm((p) => ({ ...p, dataTeste: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Sistemas/bases restaurados *</Label>
              <Input
                placeholder="Ex.: Sistema de escrituras, Banco de dados principal"
                value={form.sistemasRestaurados}
                onChange={(e) => setForm((p) => ({ ...p, sistemasRestaurados: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  RTO aferido (horas) *
                  <InfoTooltip chave="RTO" />
                </Label>
                <Input type="number" step="0.1" value={form.rtoAferido} onChange={(e) => setForm((p) => ({ ...p, rtoAferido: e.target.value }))} required />
                <p className="text-xs text-muted-foreground">Máximo definido: {rtoDefinido}h</p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  RPO aferido (horas) *
                  <InfoTooltip chave="RPO" />
                </Label>
                <Input type="number" step="0.1" value={form.rpoAferido} onChange={(e) => setForm((p) => ({ ...p, rpoAferido: e.target.value }))} required />
                <p className="text-xs text-muted-foreground">Máximo definido: {rpoDefinido}h</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Participantes</Label>
              {participantes.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Nome"
                    value={p.nome}
                    onChange={(e) => setParticipantes((prev) => prev.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                  />
                  <Input
                    placeholder="Papel"
                    value={p.papel}
                    onChange={(e) => setParticipantes((prev) => prev.map((x, j) => j === i ? { ...x, papel: e.target.value } : x))}
                  />
                </div>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => setParticipantes((p) => [...p, { nome: '', papel: '' }])}>
                + Adicionar participante
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
