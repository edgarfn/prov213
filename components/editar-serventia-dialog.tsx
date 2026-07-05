'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { atualizarServentia } from '@/app/actions/serventia'
import { ESTADOS, CLASSE_LABEL, TIPO_SOLUCAO_LABEL, INFRA_LABEL } from '@/lib/serventia-labels'
import { Loader2 } from 'lucide-react'

function selectLabel(map: Record<string, string>) {
  return (value: unknown) => map[String(value)] ?? String(value)
}

export interface ServentiaEditavel {
  id: string
  nome: string
  cns: string
  cnpj: string | null
  municipio: string
  uf: string
  classe: string
  tipoSolucao: string
  infra: string
  dataVigenciaNorma: string | Date
  responsavelTecnico: string | null
  controladorDados: string | null
  dpo: string | null
}

interface Props {
  serventia: ServentiaEditavel
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (serventiaId: string, dados: Partial<ServentiaEditavel>) => void
}

export function EditarServentiaDialog({ serventia, open, onOpenChange, onSaved }: Props) {
  const [dados, setDados] = useState({
    nome: serventia.nome,
    cns: serventia.cns,
    cnpj: serventia.cnpj ?? '',
    municipio: serventia.municipio,
    uf: serventia.uf,
    classe: serventia.classe,
    tipoSolucao: serventia.tipoSolucao,
    infra: serventia.infra,
    dataVigenciaNorma: new Date(serventia.dataVigenciaNorma).toISOString().slice(0, 10),
    responsavelTecnico: serventia.responsavelTecnico ?? '',
    controladorDados: serventia.controladorDados ?? '',
    dpo: serventia.dpo ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function atualizar(campo: string, valor: string) {
    setDados((p) => ({ ...p, [campo]: valor }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData()
    Object.entries(dados).forEach(([k, v]) => { if (v) fd.append(k, v) })

    const result = await atualizarServentia(serventia.id, fd)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    onSaved(serventia.id, dados)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar serventia</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-1.5">
            <Label>Nome da Serventia *</Label>
            <Input value={dados.nome} onChange={(e) => atualizar('nome', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CNS *</Label>
              <Input value={dados.cns} onChange={(e) => atualizar('cns', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={dados.cnpj} onChange={(e) => atualizar('cnpj', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Município *</Label>
              <Input value={dados.municipio} onChange={(e) => atualizar('municipio', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>UF *</Label>
              <Select value={dados.uf} onValueChange={(v) => v && atualizar('uf', v)}>
                <SelectTrigger><SelectValue>{selectLabel(Object.fromEntries(ESTADOS.map((e) => [e, e])))}</SelectValue></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Classe da Serventia *</Label>
            <Select value={dados.classe} onValueChange={(v) => v && atualizar('classe', v)}>
              <SelectTrigger><SelectValue>{selectLabel(CLASSE_LABEL)}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(CLASSE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Solução de TIC *</Label>
            <Select value={dados.tipoSolucao} onValueChange={(v) => v && atualizar('tipoSolucao', v)}>
              <SelectTrigger><SelectValue>{selectLabel(TIPO_SOLUCAO_LABEL)}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_SOLUCAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Infraestrutura *</Label>
            <Select value={dados.infra} onValueChange={(v) => v && atualizar('infra', v)}>
              <SelectTrigger><SelectValue>{selectLabel(INFRA_LABEL)}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(INFRA_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data de Vigência da Norma *</Label>
            <Input type="date" value={dados.dataVigenciaNorma} onChange={(e) => atualizar('dataVigenciaNorma', e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Responsável Técnico de TIC</Label>
            <Input value={dados.responsavelTecnico} onChange={(e) => atualizar('responsavelTecnico', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Controlador de Dados (LGPD)</Label>
            <Input value={dados.controladorDados} onChange={(e) => atualizar('controladorDados', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>DPO — Encarregado de Proteção de Dados</Label>
            <Input value={dados.dpo} onChange={(e) => atualizar('dpo', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
