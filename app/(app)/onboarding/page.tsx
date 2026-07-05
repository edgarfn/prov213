'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { criarServentia } from '@/app/actions/serventia'
import { calcularClassePorArrecadacao, calcularSubclasse } from '@/lib/business-rules'
import { ChevronRight, ChevronLeft, Info, Loader2 } from 'lucide-react'

const STEPS = [
  { id: 1, title: 'Identificação', desc: 'Dados básicos da serventia' },
  { id: 2, title: 'Classificação', desc: 'Classe e infraestrutura' },
  { id: 3, title: 'Responsáveis', desc: 'Equipe de conformidade' },
  { id: 4, title: 'Revisão', desc: 'Confirmar e criar' },
]

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calculadoraArrecadacao, setCalculadoraArrecadacao] = useState('')
  const [classeSugerida, setClasseSugerida] = useState<string | null>(null)

  const [dados, setDados] = useState({
    nome: '',
    cns: '',
    cnpj: '',
    municipio: '',
    uf: '',
    classe: '',
    subclasse: '',
    arrecadacaoSemestral: '',
    tipoSolucao: '',
    infra: '',
    dataVigenciaNorma: '2026-01-01',
    responsavelTecnico: '',
    controladorDados: '',
    dpo: '',
  })

  function atualizar(campo: string, valor: string) {
    setDados((p) => ({ ...p, [campo]: valor }))
  }

  function calcularClasse() {
    const valor = parseFloat(calculadoraArrecadacao.replace(/\D/g, '')) / 100
    if (!isNaN(valor)) {
      const classe = calcularClassePorArrecadacao(valor)
      setClasseSugerida(classe)
      atualizar('classe', classe)
      atualizar('subclasse', calcularSubclasse(valor, classe))
      atualizar('arrecadacaoSemestral', String(valor))
    }
  }

  const labelClasse: Record<string, string> = {
    CLASSE_1: 'Classe 1 — Pequeno porte (até R$100 mil/semestre)',
    CLASSE_2: 'Classe 2 — Médio porte (R$100 mil–500 mil/semestre)',
    CLASSE_3: 'Classe 3 — Grande porte (acima de R$500 mil/semestre)',
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const formData = new FormData()
    Object.entries(dados).forEach(([k, v]) => { if (v) formData.append(k, v) })

    const result = await criarServentia(formData)

    if (result.error) {
      setLoading(false)
      setError(result.error)
      return
    }

    // Seleciona a nova serventia no cookie antes de navegar ao dashboard
    // (evita redirecionamentos extras pelo AppLayout)
    if (result.serventiaId) {
      await fetch('/api/auth/select-serventia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serventiaId: result.serventiaId }),
      })
    }

    setLoading(false)
    window.location.href = '/dashboard'
  }

  const canProceed = () => {
    if (step === 1) return dados.nome && dados.cns && dados.municipio && dados.uf
    if (step === 2) return dados.classe && dados.tipoSolucao && dados.infra && dados.dataVigenciaNorma
    if (step === 3) return true
    return true
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Configurar Serventia</h1>
        <p className="text-muted-foreground mt-1">
          Configure os dados do cartório para personalizar seu plano de conformidade.
        </p>
      </div>

      {/* Indicador de etapas */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === s.id
                  ? 'bg-blue-600 text-white'
                  : step > s.id
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {step > s.id ? '✓' : s.id}
            </div>
            <span className={`hidden sm:inline text-sm ${step === s.id ? 'font-medium' : 'text-muted-foreground'}`}>
              {s.title}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].title}</CardTitle>
          <CardDescription>{STEPS[step - 1].desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* STEP 1: Identificação */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Serventia *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: 1º Tabelionato de Notas de São Paulo"
                  value={dados.nome}
                  onChange={(e) => atualizar('nome', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cns">
                  CNS — Código Nacional de Serventia *
                  <span className="ml-2 text-xs text-muted-foreground">(fornecido pelo CNJ)</span>
                </Label>
                <Input
                  id="cns"
                  placeholder="Ex: SP-12345-A"
                  value={dados.cns}
                  onChange={(e) => atualizar('cns', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  value={dados.cnpj}
                  onChange={(e) => atualizar('cnpj', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="municipio">Município *</Label>
                  <Input
                    id="municipio"
                    value={dados.municipio}
                    onChange={(e) => atualizar('municipio', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf">UF *</Label>
                  <Select value={dados.uf} onValueChange={(v) => { if (v) atualizar('uf', v) }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: Classificação */}
          {step === 2 && (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Não sabe a classe do cartório?</strong>
                    <p className="mt-1">Use a calculadora abaixo baseada na arrecadação semestral.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Calculadora de Classe</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Arrecadação semestral (R$)"
                    value={calculadoraArrecadacao}
                    onChange={(e) => setCalculadoraArrecadacao(e.target.value)}
                  />
                  <Button variant="outline" onClick={calcularClasse}>Calcular</Button>
                </div>
                {classeSugerida && (
                  <p className="text-sm text-green-700 font-medium">
                    ✓ Classe sugerida: <Badge variant="outline">{labelClasse[classeSugerida]}</Badge>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Classe da Serventia *</Label>
                <Select value={dados.classe} onValueChange={(v) => { if (v) atualizar('classe', v) }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a classe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLASSE_1">Classe 1 — Pequeno porte</SelectItem>
                    <SelectItem value="CLASSE_2">Classe 2 — Médio porte</SelectItem>
                    <SelectItem value="CLASSE_3">Classe 3 — Grande porte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dados.classe && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {dados.classe === 'CLASSE_3' && 'Classe 3: RPO ≤ 4h, RTO ≤ 8h, backup ≤ 24h, internet ≥ 50 Mbps, testes semestrais, pentest obrigatório a cada 2 anos.'}
                    {dados.classe === 'CLASSE_2' && 'Classe 2: RPO ≤ 12h, RTO ≤ 24h, backup ≤ 48h, internet ≥ 10 Mbps, testes anuais.'}
                    {dados.classe === 'CLASSE_1' && 'Classe 1: RPO ≤ 24h, RTO ≤ 24h, backup ≤ 72h, internet ≥ 2 Mbps, testes anuais. Fluxo simplificado de comprovação.'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Tipo de Solução de TIC *</Label>
                <Select value={dados.tipoSolucao} onValueChange={(v) => { if (v) atualizar('tipoSolucao', v) }}>
                  <SelectTrigger><SelectValue placeholder="Como os sistemas são gerenciados?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROPRIA">Própria — TI interna</SelectItem>
                    <SelectItem value="CONTRATADA">Contratada — empresa terceirizada</SelectItem>
                    <SelectItem value="COMPARTILHADA">Compartilhada — com outras serventias</SelectItem>
                    <SelectItem value="COLETIVA">Coletiva — solução conjunta do sistema notarial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Infraestrutura *</Label>
                <Select value={dados.infra} onValueChange={(v) => { if (v) atualizar('infra', v) }}>
                  <SelectTrigger><SelectValue placeholder="Onde ficam os sistemas?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL">Local — servidores físicos no cartório</SelectItem>
                    <SelectItem value="NUVEM">Nuvem — sistemas em cloud</SelectItem>
                    <SelectItem value="HIBRIDA">Híbrida — parte local, parte em nuvem</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vigencia">
                  Data de Vigência da Norma *
                  <span className="ml-2 text-xs text-muted-foreground">
                    (início do prazo — normalmente a data de publicação no DJe)
                  </span>
                </Label>
                <Input
                  id="vigencia"
                  type="date"
                  value={dados.dataVigenciaNorma}
                  onChange={(e) => atualizar('dataVigenciaNorma', e.target.value)}
                />
              </div>
            </>
          )}

          {/* STEP 3: Responsáveis */}
          {step === 3 && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-2">
                A designação formal dos responsáveis é exigência do Art. 6º do Provimento. Você pode preencher agora ou depois nas configurações.
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt">Responsável Técnico de TIC</Label>
                <Input
                  id="rt"
                  placeholder="Nome completo"
                  value={dados.responsavelTecnico}
                  onChange={(e) => atualizar('responsavelTecnico', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd">Controlador de Dados (LGPD)</Label>
                <Input
                  id="cd"
                  placeholder="Nome completo — geralmente o próprio titular"
                  value={dados.controladorDados}
                  onChange={(e) => atualizar('controladorDados', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dpo">
                  DPO — Encarregado de Proteção de Dados
                  <span className="ml-2 text-xs text-muted-foreground">(pode ser externo)</span>
                </Label>
                <Input
                  id="dpo"
                  placeholder="Nome completo ou empresa"
                  value={dados.dpo}
                  onChange={(e) => atualizar('dpo', e.target.value)}
                />
              </div>
            </>
          )}

          {/* STEP 4: Revisão */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 border p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{dados.nome}</span>
                  <span className="text-muted-foreground">CNS:</span>
                  <span className="font-medium">{dados.cns}</span>
                  <span className="text-muted-foreground">Município/UF:</span>
                  <span className="font-medium">{dados.municipio}/{dados.uf}</span>
                  <span className="text-muted-foreground">Classe:</span>
                  <span className="font-medium">{dados.classe?.replace('_', ' ')}</span>
                  <span className="text-muted-foreground">Infraestrutura:</span>
                  <span className="font-medium">{dados.infra}</span>
                  <span className="text-muted-foreground">Tipo de Solução:</span>
                  <span className="font-medium">{dados.tipoSolucao}</span>
                  <span className="text-muted-foreground">Vigência:</span>
                  <span className="font-medium">{dados.dataVigenciaNorma}</span>
                  {dados.responsavelTecnico && <>
                    <span className="text-muted-foreground">Resp. Técnico:</span>
                    <span className="font-medium">{dados.responsavelTecnico}</span>
                  </>}
                  {dados.dpo && <>
                    <span className="text-muted-foreground">DPO:</span>
                    <span className="font-medium">{dados.dpo}</span>
                  </>}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Ao confirmar, o sistema criará os checklists personalizados para a {dados.classe?.replace('_', ' ')} e calculará todos os prazos legais.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep((p) => p - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep((p) => p + 1)} disabled={!canProceed()}>
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Criar meu plano de conformidade
          </Button>
        )}
      </div>
    </div>
  )
}
