'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { criarVulnerabilidade, atualizarVulnerabilidade } from '@/app/actions/vulnerabilidades'
import { calcularSemaforo } from '@/lib/business-rules'
import { InfoTooltip } from '@/components/info-tooltip'
import type { Vulnerabilidade, RolePapel } from '@/types/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bug, Plus, Clock, CheckCircle2, Zap } from 'lucide-react'

const FORM_INITIAL = { descricao: '', dataIdentificacao: '', classificacaoRisco: 'Crítico', exploracaoAtiva: false }

interface Props {
  serventiaId: string
  vulnerabilidades: Vulnerabilidade[]
  papelAtual: RolePapel
}

export function VulnerabilidadesClient({ serventiaId, vulnerabilidades, papelAtual }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Vulnerabilidade | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [providencias, setProvidencias] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.append('descricao', form.descricao)
    fd.append('dataIdentificacao', form.dataIdentificacao)
    fd.append('classificacaoRisco', form.classificacaoRisco)
    fd.append('exploracaoAtiva', String(form.exploracaoAtiva))
    startTransition(async () => {
      const result = await criarVulnerabilidade(serventiaId, fd)
      if (result.error) { setError(result.error); return }
      setCreateOpen(false)
      setForm(FORM_INITIAL)
    })
  }

  function abrirDetalhe(v: Vulnerabilidade) {
    setSelected(v)
    setProvidencias(v.providencias ?? '')
    setError(null)
  }

  function salvarProvidencias(encerrar: boolean) {
    if (!selected) return
    setError(null)
    const fd = new FormData()
    fd.append('providencias', providencias)
    if (encerrar) fd.append('encerrar', 'true')
    startTransition(async () => {
      const result = await atualizarVulnerabilidade(serventiaId, selected.id, fd)
      if (result.error) { setError(result.error); return }
      setSelected(null)
    })
  }

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

      {vulnerabilidades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bug className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma vulnerabilidade registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vulnerabilidades.map((v) => {
            const encerrada = !!v.dataEncerramento
            const semaforo = encerrada ? 'verde' : calcularSemaforo(v.prazoLimite)
            return (
              <Card key={v.id} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => abrirDetalhe(v)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{v.classificacaoRisco}</Badge>
                        {v.exploracaoAtiva && (
                          <Badge variant="outline" className="text-xs text-red-700 border-red-200 bg-red-50">
                            <Zap className="h-3 w-3 mr-1" />Exploração ativa
                          </Badge>
                        )}
                        {encerrada && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Encerrada
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm mt-1.5">{v.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Identificada em {format(v.dataIdentificacao, 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar vulnerabilidade</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea rows={3} value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Data de identificação *</Label>
              <Input type="date" value={form.dataIdentificacao} onChange={(e) => setForm((p) => ({ ...p, dataIdentificacao: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Classificação de risco *</Label>
              <Input value={form.classificacaoRisco} onChange={(e) => setForm((p) => ({ ...p, classificacaoRisco: e.target.value }))} placeholder="Ex.: Crítico, Alto" required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.exploracaoAtiva} onChange={(e) => setForm((p) => ({ ...p, exploracaoAtiva: e.target.checked }))} />
              Há evidência de exploração ativa ou risco iminente (prazo cai para 72h)
              <InfoTooltip chave="EXPLORACAO_ATIVA" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>Registrar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.classificacaoRisco}</DialogTitle></DialogHeader>
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
                <div className="space-y-1.5">
                  <Label>Providências adotadas</Label>
                  <Textarea rows={3} value={providencias} onChange={(e) => setProvidencias(e.target.value)} disabled={somenteLeitura} />
                </div>
                {!somenteLeitura && !selected.dataEncerramento && (
                  <div className="flex justify-between pt-2">
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={() => salvarProvidencias(false)}>Salvar providências</Button>
                    <Button size="sm" disabled={isPending} onClick={() => salvarProvidencias(true)}>Encerrar</Button>
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
