'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from '@/components/info-tooltip'
import { EvidenciasUpload } from '@/components/evidencias-upload'
import {
  registrarAnaliseRisco,
  registrarParecerDpo,
  decidirRecomendacao,
  emitirOrdemImplementacao,
  registrarExecucao,
  registrarAceite,
  registrarAtualizacaoDocumentos,
} from '@/app/actions/recomendacao-tecnica'
import type { RecomendacaoTecnica, Evidencia, RolePapel } from '@/types/prisma'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Lock } from 'lucide-react'

const PRIORIDADE_LABEL: Record<string, string> = { BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto', CRITICO: 'Crítico' }
const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  COMPLEMENTACAO_SOLICITADA: 'Complementação técnica solicitada',
  AGUARDANDO_PARECER_DPO: 'Aguardando parecer do DPO',
  AGUARDANDO_DECISAO: 'Aguardando decisão do Controlador',
  REJEITADO: 'Rejeitado',
  RISCO_ACEITO_TEMPORARIO: 'Risco aceito temporariamente',
  APROVADO_AGUARDANDO_IMPLEMENTACAO: 'Aprovado — aguardando ordem de implementação',
  EM_IMPLEMENTACAO: 'Em implementação',
  AGUARDANDO_ACEITE: 'Aguardando teste e aceite',
  AGUARDANDO_ATUALIZACAO_DOCUMENTOS: 'Aguardando atualização dos documentos',
  CONCLUIDO: 'Concluído',
}
const DECISAO_LABEL: Record<string, string> = {
  APROVADO_INTEGRAL: 'Aprovado integralmente',
  APROVADO_COM_CONDICOES: 'Aprovado com condições',
  APROVADO_IMPLANTACAO_FUTURA: 'Aprovado para implantação futura',
  COMPLEMENTACAO_SOLICITADA: 'Solicitada complementação técnica',
  REJEITADO: 'Rejeitado com justificativa',
  RISCO_ACEITO_TEMPORARIO: 'Risco aceito temporariamente, com prazo corretivo',
  SUBSTITUIDO_EQUIVALENTE: 'Substituído por solução tecnicamente equivalente',
}
const RESULTADO_ACEITE_LABEL: Record<string, string> = {
  INTEGRAL: 'Aceite integral', PARCIAL: 'Aceite parcial', NAO_CONFORME: 'Rejeição (não conforme)',
}

function selectLabel(map: Record<string, string>) {
  return (value: unknown) => map[String(value)] ?? String(value)
}

function CampoLeitura({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function AbaBloqueada({ motivo }: { motivo: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      <Lock className="h-4 w-4 flex-shrink-0" />
      {motivo}
    </div>
  )
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR })
}

// ─── Formato dos blocos Json por etapa ───────────────────────────────────────

interface Etapa1Data {
  situacaoAtual: string; problemaDeficiencia: string; requisitoRelacionado: string | null
  ativoAfetado: string | null; riscoNaoImplementar: string; solucaoRecomendada: string
  alternativasPossiveis: string | null; estimativaCusto: string | null; evidenciasColetadasObs: string | null
}
interface Etapa2Data {
  probabilidadeOcorrencia: string; impactoOperacional: string; impactoDadosPessoais: string | null
  impactoAcervoRegistral: string; impactoFinanceiro: string | null; impactoJuridicoCorrecional: string | null
  controlesExistentes: string | null; controlesRecomendados: string; riscoResidualAposImplementacao: string
  consequenciaRejeicao: string; relacaoPcnPrd: string | null; relacaoRpoRto: string | null
}
interface Etapa3Data {
  necessidadeProporcionalidade: string; dadosSensiveisEnvolvidos: string | null; novosFornecedores: string | null
  acessosRemotos: string | null; armazenamentoNuvem: string | null; transferenciaInternacional: string | null
  logsMonitoramento: string | null; retencao: string | null; contratosOperadores: string | null
  riscoTitulares: string; necessidadeRipd: boolean; necessidadeAtualizarRopa: boolean; conclusao: string
}
interface TermoCienciaData {
  fundamentoTecnico: string; consequenciasRejeicao: string; alternativasApresentadas: string | null
  motivoDeclarado: string; medidasCompensatorias: string | null
}
interface Etapa5Data {
  escopoAprovado: string; equipamentosServicos: string | null; responsaveis: string | null; planoRollback: string
  riscosMudanca: string | null; backupAnterior: string | null; criteriosSucesso: string
  testesObrigatorios: string | null; indisponibilidadePrevista: string | null
  comunicacaoColaboradores: string | null; autorizacaoAcessoPrivilegiado: string | null
}
interface Etapa6Data {
  relatorioTecnico: string; configuracaoAnterior: string | null; configuracaoPosterior: string | null
  usuariosExecutores: string | null; resultadosTestes: string | null; falhas: string | null; medidasCorretivas: string | null
}
interface Etapa7Data {
  requisitoAtendido: string; testesRealizados: string; resultadoObtido: string
  pendencias: string | null; riscoResidual: string | null
}
interface Etapa8Data {
  inventarioAtivos: boolean; diagramaRede: boolean; pcn: boolean; prd: boolean; psi: boolean; ropa: boolean
  matrizRiscos: boolean; planoBackup: boolean; dossieTecnico: boolean; outros: string | null
}

type PessoaResumo = { name: string | null; email: string } | null
type MembroResumo = { id: string; name: string | null; email: string; papel: string }

export type RecomendacaoComRelacoes = RecomendacaoTecnica & {
  responsavelTecnico: PessoaResumo
  parecerDpoUser: PessoaResumo
  decisaoControlador: PessoaResumo
  responsavelExecucao: PessoaResumo
  ordemEmitidaPor: PessoaResumo
  aceiteTecnico: PessoaResumo
  aceiteControlador: PessoaResumo
  evidencias: Evidencia[]
}

interface Props {
  serventiaId: string
  recomendacao: RecomendacaoComRelacoes
  membros: MembroResumo[]
  papelAtual: RolePapel
  existeDpo: boolean
  retencaoAnos: number
  onClose: () => void
}

export function RecomendacaoTecnicaDetalhe({ serventiaId, recomendacao: r, membros, papelAtual, existeDpo, retencaoAnos, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const somenteLeitura = papelAtual === 'AUDITOR_LEITURA'
  const titulares = useMemo(() => membros.filter((m) => m.papel === 'TITULAR'), [membros])

  const dados1 = r.recomendacao as unknown as Etapa1Data
  const dados2 = r.analiseRisco as unknown as Etapa2Data | null
  const dados3 = r.parecerDpo as unknown as Etapa3Data | null
  const termo = r.termoCiencia as unknown as TermoCienciaData | null
  const dados5 = r.ordemImplementacao as unknown as Etapa5Data | null
  const dados6 = r.execucao as unknown as Etapa6Data | null
  const dados7 = r.aceite as unknown as Etapa7Data | null
  const dados8 = r.documentosAtualizados as unknown as Etapa8Data | null

  const etapa2Editable = !somenteLeitura && (r.status === 'RASCUNHO' || r.status === 'COMPLEMENTACAO_SOLICITADA')
  const etapa3Visible = r.envolveDadosPessoais
  const etapa3Editable = !somenteLeitura && papelAtual === 'DPO' && r.status === 'AGUARDANDO_PARECER_DPO'
  const etapa4Editable = !somenteLeitura && papelAtual === 'TITULAR' && r.status === 'AGUARDANDO_DECISAO'
  const etapa5Editable = !somenteLeitura && r.status === 'APROVADO_AGUARDANDO_IMPLEMENTACAO'
  const etapa6Editable = !somenteLeitura && r.status === 'EM_IMPLEMENTACAO'
  const etapa7Editable = !somenteLeitura && r.status === 'AGUARDANDO_ACEITE'
  const etapa8Editable = !somenteLeitura && r.status === 'AGUARDANDO_ATUALIZACAO_DOCUMENTOS'

  const abaPadrao = etapa2Editable
    ? 'etapa2'
    : etapa3Visible && (etapa3Editable || !dados3)
      ? 'etapa3'
      : etapa4Editable || (!dados2 ? 'etapa2' : !r.decisao)
        ? 'etapa4'
        : etapa5Editable || !dados5
          ? 'etapa5'
          : etapa6Editable || !dados6
            ? 'etapa6'
            : etapa7Editable || !dados7
              ? 'etapa7'
              : 'etapa8'

  // ─── Etapa 2 — Análise de Risco ────────────────────────────────────────────
  const [f2, setF2] = useState({
    classificacaoRiscoFinal: r.classificacaoRiscoFinal ?? 'ALTO',
    envolveDadosPessoais: r.envolveDadosPessoais,
    probabilidadeOcorrencia: dados2?.probabilidadeOcorrencia ?? '',
    impactoOperacional: dados2?.impactoOperacional ?? '',
    impactoDadosPessoais: dados2?.impactoDadosPessoais ?? '',
    impactoAcervoRegistral: dados2?.impactoAcervoRegistral ?? '',
    impactoFinanceiro: dados2?.impactoFinanceiro ?? '',
    impactoJuridicoCorrecional: dados2?.impactoJuridicoCorrecional ?? '',
    controlesExistentes: dados2?.controlesExistentes ?? '',
    controlesRecomendados: dados2?.controlesRecomendados ?? '',
    riscoResidualAposImplementacao: dados2?.riscoResidualAposImplementacao ?? '',
    consequenciaRejeicao: dados2?.consequenciaRejeicao ?? '',
    relacaoPcnPrd: dados2?.relacaoPcnPrd ?? '',
    relacaoRpoRto: dados2?.relacaoRpoRto ?? '',
  })

  function submitEtapa2(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(f2).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await registrarAnaliseRisco(serventiaId, r.id, fd)
      if (result.error) setError(result.error)
    })
  }

  // ─── Etapa 3 — Parecer do DPO ──────────────────────────────────────────────
  const [f3, setF3] = useState({
    necessidadeProporcionalidade: dados3?.necessidadeProporcionalidade ?? '',
    dadosSensiveisEnvolvidos: dados3?.dadosSensiveisEnvolvidos ?? '',
    novosFornecedores: dados3?.novosFornecedores ?? '',
    acessosRemotos: dados3?.acessosRemotos ?? '',
    armazenamentoNuvem: dados3?.armazenamentoNuvem ?? '',
    transferenciaInternacional: dados3?.transferenciaInternacional ?? '',
    logsMonitoramento: dados3?.logsMonitoramento ?? '',
    retencao: dados3?.retencao ?? '',
    contratosOperadores: dados3?.contratosOperadores ?? '',
    riscoTitulares: dados3?.riscoTitulares ?? '',
    necessidadeRipd: dados3?.necessidadeRipd ?? false,
    necessidadeAtualizarRopa: dados3?.necessidadeAtualizarRopa ?? false,
    conclusao: dados3?.conclusao ?? '',
  })

  function submitEtapa3(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(f3).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await registrarParecerDpo(serventiaId, r.id, fd)
      if (result.error) setError(result.error)
    })
  }

  // ─── Etapa 4 — Decisão do Controlador ──────────────────────────────────────
  const [f4, setF4] = useState({
    decisao: r.decisao ?? 'APROVADO_INTEGRAL',
    valorAutorizado: r.valorAutorizado?.toString() ?? '',
    prazoImplantacao: r.prazoImplantacao ? new Date(r.prazoImplantacao).toISOString().slice(0, 10) : '',
    responsavelExecucaoId: r.responsavelExecucaoId ?? '_none',
    fonteOrcamentaria: '',
    condicoesImpostas: '',
    riscoResidualConhecido: '',
    prazoReavaliacao: r.prazoReavaliacao ? new Date(r.prazoReavaliacao).toISOString().slice(0, 10) : '',
    fundamentoTecnico: termo?.fundamentoTecnico ?? '',
    consequenciasRejeicao: termo?.consequenciasRejeicao ?? '',
    alternativasApresentadas: termo?.alternativasApresentadas ?? '',
    motivoDeclarado: termo?.motivoDeclarado ?? '',
    medidasCompensatorias: termo?.medidasCompensatorias ?? '',
  })
  const precisaTermo = f4.decisao === 'REJEITADO' || f4.decisao === 'RISCO_ACEITO_TEMPORARIO'

  function submitEtapa4(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(f4).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await decidirRecomendacao(serventiaId, r.id, fd)
      if (result.error) setError(result.error)
    })
  }

  // ─── Etapa 5 — Ordem de Implementação ──────────────────────────────────────
  const [f5, setF5] = useState({
    dataExecucaoPlanejada: r.dataExecucaoPlanejada ? new Date(r.dataExecucaoPlanejada).toISOString().slice(0, 10) : '',
    escopoAprovado: dados5?.escopoAprovado ?? '',
    equipamentosServicos: dados5?.equipamentosServicos ?? '',
    responsaveis: dados5?.responsaveis ?? '',
    planoRollback: dados5?.planoRollback ?? '',
    riscosMudanca: dados5?.riscosMudanca ?? '',
    backupAnterior: dados5?.backupAnterior ?? '',
    criteriosSucesso: dados5?.criteriosSucesso ?? '',
    testesObrigatorios: dados5?.testesObrigatorios ?? '',
    indisponibilidadePrevista: dados5?.indisponibilidadePrevista ?? '',
    comunicacaoColaboradores: dados5?.comunicacaoColaboradores ?? '',
    autorizacaoAcessoPrivilegiado: dados5?.autorizacaoAcessoPrivilegiado ?? '',
  })

  function submitEtapa5(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(f5).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await emitirOrdemImplementacao(serventiaId, r.id, fd)
      if (result.error) setError(result.error)
    })
  }

  // ─── Etapa 6 — Execução ────────────────────────────────────────────────────
  const [f6, setF6] = useState({
    dataExecucaoRealizada: r.dataExecucaoRealizada ? new Date(r.dataExecucaoRealizada).toISOString().slice(0, 10) : '',
    relatorioTecnico: dados6?.relatorioTecnico ?? '',
    configuracaoAnterior: dados6?.configuracaoAnterior ?? '',
    configuracaoPosterior: dados6?.configuracaoPosterior ?? '',
    usuariosExecutores: dados6?.usuariosExecutores ?? '',
    resultadosTestes: dados6?.resultadosTestes ?? '',
    falhas: dados6?.falhas ?? '',
    medidasCorretivas: dados6?.medidasCorretivas ?? '',
  })

  function submitEtapa6(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(f6).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await registrarExecucao(serventiaId, r.id, fd)
      if (result.error) setError(result.error)
    })
  }

  // ─── Etapa 7 — Teste e Aceite ──────────────────────────────────────────────
  const [f7, setF7] = useState({
    aceiteResultado: r.aceiteResultado ?? 'INTEGRAL',
    aceiteControladorUserId: r.aceiteControladorUserId ?? '',
    requisitoAtendido: dados7?.requisitoAtendido ?? '',
    testesRealizados: dados7?.testesRealizados ?? '',
    resultadoObtido: dados7?.resultadoObtido ?? '',
    pendencias: dados7?.pendencias ?? '',
    riscoResidual: dados7?.riscoResidual ?? '',
  })

  function submitEtapa7(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f7.aceiteControladorUserId) { setError('Selecione o Controlador que assina o aceite.'); return }
    const fd = new FormData()
    Object.entries(f7).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await registrarAceite(serventiaId, r.id, fd)
      if (result.error) setError(result.error)
    })
  }

  // ─── Etapa 8 — Atualização dos documentos de governança ────────────────────
  const [f8, setF8] = useState({
    inventarioAtivos: dados8?.inventarioAtivos ?? false,
    diagramaRede: dados8?.diagramaRede ?? false,
    pcn: dados8?.pcn ?? false,
    prd: dados8?.prd ?? false,
    psi: dados8?.psi ?? false,
    ropa: dados8?.ropa ?? false,
    matrizRiscos: dados8?.matrizRiscos ?? false,
    planoBackup: dados8?.planoBackup ?? false,
    dossieTecnico: dados8?.dossieTecnico ?? false,
    outros: dados8?.outros ?? '',
  })
  const DOC_CHECKLIST: Array<{ key: keyof typeof f8; label: string }> = [
    { key: 'inventarioAtivos', label: 'Inventário de ativos' },
    { key: 'diagramaRede', label: 'Diagrama de rede' },
    { key: 'pcn', label: 'PCN' },
    { key: 'prd', label: 'PRD' },
    { key: 'psi', label: 'Política de Segurança da Informação' },
    { key: 'ropa', label: 'ROPA' },
    { key: 'matrizRiscos', label: 'Matriz de riscos' },
    { key: 'planoBackup', label: 'Plano de backup' },
    { key: 'dossieTecnico', label: 'Dossiê técnico do Provimento 213' },
  ]

  function submitEtapa8(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    Object.entries(f8).forEach(([k, v]) => fd.append(k, String(v)))
    startTransition(async () => {
      const result = await registrarAtualizacaoDocumentos(serventiaId, r.id, fd)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{r.codigo}</p>
          <h2 className="text-lg font-semibold">{dados1.problemaDeficiencia}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{PRIORIDADE_LABEL[r.prioridade]}</Badge>
            <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Tabs defaultValue={abaPadrao}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="etapa1">1. Recomendação</TabsTrigger>
          <TabsTrigger value="etapa2">2. Análise de Risco</TabsTrigger>
          {etapa3Visible && <TabsTrigger value="etapa3">3. Parecer DPO</TabsTrigger>}
          <TabsTrigger value="etapa4">4. Decisão</TabsTrigger>
          <TabsTrigger value="etapa5">5. Ordem</TabsTrigger>
          <TabsTrigger value="etapa6">6. Execução</TabsTrigger>
          <TabsTrigger value="etapa7">7. Aceite</TabsTrigger>
          <TabsTrigger value="etapa8">8. Documentos</TabsTrigger>
        </TabsList>

        {/* Etapa 1 — sempre somente leitura (registrada na criação) */}
        <TabsContent value="etapa1" className="space-y-3 pt-3">
          <CampoLeitura label="Situação atual" value={dados1.situacaoAtual} />
          <CampoLeitura label="Problema/deficiência" value={dados1.problemaDeficiencia} />
          <CampoLeitura label="Requisito relacionado" value={dados1.requisitoRelacionado} />
          <CampoLeitura label="Sistema/ativo/processo afetado" value={dados1.ativoAfetado} />
          <CampoLeitura label="Risco de não implementar" value={dados1.riscoNaoImplementar} />
          <CampoLeitura label="Solução recomendada" value={dados1.solucaoRecomendada} />
          <CampoLeitura label="Alternativas possíveis" value={dados1.alternativasPossiveis} />
          <CampoLeitura label="Estimativa de custo" value={dados1.estimativaCusto} />
          <CampoLeitura label="Observações sobre evidências coletadas" value={dados1.evidenciasColetadasObs} />
          <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <div><p className="text-xs text-muted-foreground">Data de identificação</p>{fmtDate(r.dataIdentificacao)}</div>
            <div><p className="text-xs text-muted-foreground">Prazo recomendado</p>{fmtDate(r.prazoRecomendado)}</div>
            <div><p className="text-xs text-muted-foreground">Responsável técnico</p>{r.responsavelTecnico?.name ?? r.responsavelTecnico?.email}</div>
          </div>
        </TabsContent>

        {/* Etapa 2 — Análise de Risco */}
        <TabsContent value="etapa2" className="space-y-3 pt-3">
          {!etapa2Editable && !dados2 ? (
            <AbaBloqueada motivo="Aguardando o preenchimento da Etapa 1." />
          ) : etapa2Editable ? (
            <form onSubmit={submitEtapa2} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Classificação de risco final *</Label>
                <Select value={f2.classificacaoRiscoFinal} onValueChange={(v) => v && setF2((p) => ({ ...p, classificacaoRiscoFinal: v }))}>
                  <SelectTrigger><SelectValue>{selectLabel(PRIORIDADE_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f2.envolveDadosPessoais} onChange={(e) => setF2((p) => ({ ...p, envolveDadosPessoais: e.target.checked }))} />
                Esta mudança envolve dados pessoais (exige Parecer do DPO)
                <InfoTooltip chave="ANALISE_RISCO_CONFORMIDADE" />
              </label>
              {(
                [
                  ['probabilidadeOcorrencia', 'Probabilidade de ocorrência *'],
                  ['impactoOperacional', 'Impacto operacional *'],
                  ['impactoDadosPessoais', 'Impacto sobre dados pessoais'],
                  ['impactoAcervoRegistral', 'Impacto sobre o acervo registral *'],
                  ['impactoFinanceiro', 'Impacto financeiro'],
                  ['impactoJuridicoCorrecional', 'Impacto jurídico e correicional'],
                  ['controlesExistentes', 'Controles existentes'],
                  ['controlesRecomendados', 'Controles recomendados *'],
                  ['riscoResidualAposImplementacao', 'Risco residual após implementação *'],
                  ['consequenciaRejeicao', 'Consequência da rejeição *'],
                  ['relacaoPcnPrd', 'Relação com o PCN/PRD'],
                  ['relacaoRpoRto', 'Relação com o RPO/RTO'],
                ] as Array<[keyof typeof f2, string]>
              ).map(([key, label]) => (
                <div className="space-y-1.5" key={key}>
                  <Label>{label}</Label>
                  <Textarea
                    rows={2}
                    value={String(f2[key])}
                    onChange={(e) => setF2((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex justify-end"><Button type="submit" disabled={isPending}>Salvar e enviar</Button></div>
            </form>
          ) : dados2 ? (
            <>
              <div className="flex items-center gap-2"><Badge variant="outline">{PRIORIDADE_LABEL[r.classificacaoRiscoFinal ?? '']}</Badge></div>
              <CampoLeitura label="Probabilidade de ocorrência" value={dados2.probabilidadeOcorrencia} />
              <CampoLeitura label="Impacto operacional" value={dados2.impactoOperacional} />
              <CampoLeitura label="Impacto sobre dados pessoais" value={dados2.impactoDadosPessoais} />
              <CampoLeitura label="Impacto sobre o acervo registral" value={dados2.impactoAcervoRegistral} />
              <CampoLeitura label="Impacto financeiro" value={dados2.impactoFinanceiro} />
              <CampoLeitura label="Impacto jurídico e correicional" value={dados2.impactoJuridicoCorrecional} />
              <CampoLeitura label="Controles existentes" value={dados2.controlesExistentes} />
              <CampoLeitura label="Controles recomendados" value={dados2.controlesRecomendados} />
              <CampoLeitura label="Risco residual após implementação" value={dados2.riscoResidualAposImplementacao} />
              <CampoLeitura label="Consequência da rejeição" value={dados2.consequenciaRejeicao} />
              <CampoLeitura label="Relação com o PCN/PRD" value={dados2.relacaoPcnPrd} />
              <CampoLeitura label="Relação com o RPO/RTO" value={dados2.relacaoRpoRto} />
            </>
          ) : null}
        </TabsContent>

        {/* Etapa 3 — Parecer do DPO */}
        {etapa3Visible && (
          <TabsContent value="etapa3" className="space-y-3 pt-3">
            {!existeDpo && !dados3 && (
              <Alert><AlertDescription>Nenhum membro com papel DPO está designado nesta serventia. Designe um em Configurações → Usuários antes de registrar o parecer (Requisito 1.1).</AlertDescription></Alert>
            )}
            {etapa3Editable ? (
              <form onSubmit={submitEtapa3} className="space-y-3">
                {(
                  [
                    ['necessidadeProporcionalidade', 'Necessidade e proporcionalidade *'],
                    ['dadosSensiveisEnvolvidos', 'Dados sensíveis envolvidos'],
                    ['novosFornecedores', 'Novos fornecedores'],
                    ['acessosRemotos', 'Acessos remotos'],
                    ['armazenamentoNuvem', 'Armazenamento em nuvem'],
                    ['transferenciaInternacional', 'Transferência internacional'],
                    ['logsMonitoramento', 'Logs e monitoramento'],
                    ['retencao', 'Retenção de dados'],
                    ['contratosOperadores', 'Contratos com operadores e suboperadores'],
                    ['riscoTitulares', 'Risco aos direitos dos titulares *'],
                  ] as Array<[keyof typeof f3, string]>
                ).map(([key, label]) => (
                  <div className="space-y-1.5" key={key}>
                    <Label>{label}</Label>
                    <Textarea rows={2} value={String(f3[key])} onChange={(e) => setF3((p) => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f3.necessidadeRipd} onChange={(e) => setF3((p) => ({ ...p, necessidadeRipd: e.target.checked }))} />
                  Necessidade de RIPD (Relatório de Impacto)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f3.necessidadeAtualizarRopa} onChange={(e) => setF3((p) => ({ ...p, necessidadeAtualizarRopa: e.target.checked }))} />
                  Necessidade de atualizar o ROPA
                </label>
                <div className="space-y-1.5">
                  <Label>Conclusão do parecer *</Label>
                  <Textarea rows={3} value={f3.conclusao} onChange={(e) => setF3((p) => ({ ...p, conclusao: e.target.value }))} />
                </div>
                <div className="flex justify-end"><Button type="submit" disabled={isPending}>Registrar parecer</Button></div>
              </form>
            ) : dados3 ? (
              <>
                <CampoLeitura label="Necessidade e proporcionalidade" value={dados3.necessidadeProporcionalidade} />
                <CampoLeitura label="Dados sensíveis envolvidos" value={dados3.dadosSensiveisEnvolvidos} />
                <CampoLeitura label="Novos fornecedores" value={dados3.novosFornecedores} />
                <CampoLeitura label="Acessos remotos" value={dados3.acessosRemotos} />
                <CampoLeitura label="Armazenamento em nuvem" value={dados3.armazenamentoNuvem} />
                <CampoLeitura label="Transferência internacional" value={dados3.transferenciaInternacional} />
                <CampoLeitura label="Logs e monitoramento" value={dados3.logsMonitoramento} />
                <CampoLeitura label="Retenção de dados" value={dados3.retencao} />
                <CampoLeitura label="Contratos com operadores" value={dados3.contratosOperadores} />
                <CampoLeitura label="Risco aos titulares" value={dados3.riscoTitulares} />
                <p className="text-sm">RIPD necessário: {dados3.necessidadeRipd ? 'Sim' : 'Não'} · Atualizar ROPA: {dados3.necessidadeAtualizarRopa ? 'Sim' : 'Não'}</p>
                <CampoLeitura label="Conclusão" value={dados3.conclusao} />
                <p className="text-xs text-muted-foreground">Parecer de {r.parecerDpoUser?.name ?? r.parecerDpoUser?.email} em {fmtDate(r.parecerDpoConcluidoEm)}</p>
              </>
            ) : (
              <AbaBloqueada motivo="Disponível para o DPO assim que a Etapa 2 for concluída." />
            )}
          </TabsContent>
        )}

        {/* Etapa 4 — Decisão do Controlador */}
        <TabsContent value="etapa4" className="space-y-3 pt-3">
          {etapa4Editable ? (
            <form onSubmit={submitEtapa4} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">Decisão *<InfoTooltip chave="DECISAO_CONTROLADOR" /></Label>
                <Select value={f4.decisao} onValueChange={(v) => v && setF4((p) => ({ ...p, decisao: v as typeof p.decisao }))}>
                  <SelectTrigger><SelectValue>{selectLabel(DECISAO_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(DECISAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Valor autorizado (R$)</Label><Input type="number" step="0.01" value={f4.valorAutorizado} onChange={(e) => setF4((p) => ({ ...p, valorAutorizado: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Prazo de implantação</Label><Input type="date" value={f4.prazoImplantacao} onChange={(e) => setF4((p) => ({ ...p, prazoImplantacao: e.target.value }))} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Responsável pela execução</Label>
                <Select value={f4.responsavelExecucaoId} onValueChange={(v) => v && setF4((p) => ({ ...p, responsavelExecucaoId: v }))}>
                  <SelectTrigger><SelectValue>{(v: unknown) => (v === '_none' ? 'Não atribuído' : membros.find((m) => m.id === v)?.name ?? String(v))}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Não atribuído</SelectItem>
                    {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Fonte orçamentária</Label><Input value={f4.fonteOrcamentaria} onChange={(e) => setF4((p) => ({ ...p, fonteOrcamentaria: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Condições impostas</Label><Textarea rows={2} value={f4.condicoesImpostas} onChange={(e) => setF4((p) => ({ ...p, condicoesImpostas: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Risco residual conhecido</Label><Textarea rows={2} value={f4.riscoResidualConhecido} onChange={(e) => setF4((p) => ({ ...p, riscoResidualConhecido: e.target.value }))} /></div>

              {precisaTermo && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    Termo de Ciência, Recusa e Aceitação Temporária de Risco
                    <InfoTooltip chave="TERMO_CIENCIA_RISCO" />
                  </p>
                  <div className="space-y-1.5"><Label>Fundamento técnico *</Label><Textarea rows={2} value={f4.fundamentoTecnico} onChange={(e) => setF4((p) => ({ ...p, fundamentoTecnico: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Consequências da rejeição *</Label><Textarea rows={2} value={f4.consequenciasRejeicao} onChange={(e) => setF4((p) => ({ ...p, consequenciasRejeicao: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Alternativas apresentadas</Label><Textarea rows={2} value={f4.alternativasApresentadas} onChange={(e) => setF4((p) => ({ ...p, alternativasApresentadas: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Motivo declarado *</Label><Textarea rows={2} value={f4.motivoDeclarado} onChange={(e) => setF4((p) => ({ ...p, motivoDeclarado: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Medidas compensatórias</Label><Textarea rows={2} value={f4.medidasCompensatorias} onChange={(e) => setF4((p) => ({ ...p, medidasCompensatorias: e.target.value }))} /></div>
                  {f4.decisao === 'RISCO_ACEITO_TEMPORARIO' && (
                    <div className="space-y-1.5"><Label>Prazo de reavaliação *</Label><Input type="date" value={f4.prazoReavaliacao} onChange={(e) => setF4((p) => ({ ...p, prazoReavaliacao: e.target.value }))} /></div>
                  )}
                </div>
              )}
              <div className="flex justify-end"><Button type="submit" disabled={isPending}>Registrar decisão</Button></div>
            </form>
          ) : r.decisao ? (
            <>
              <Badge variant="outline">{DECISAO_LABEL[r.decisao]}</Badge>
              <p className="text-xs text-muted-foreground mt-1">Decidido por {r.decisaoControlador?.name ?? r.decisaoControlador?.email} em {fmtDate(r.dataDecisao)}</p>
              {termo && (
                <div className="space-y-2 pt-2">
                  <CampoLeitura label="Fundamento técnico" value={termo.fundamentoTecnico} />
                  <CampoLeitura label="Consequências da rejeição" value={termo.consequenciasRejeicao} />
                  <CampoLeitura label="Alternativas apresentadas" value={termo.alternativasApresentadas} />
                  <CampoLeitura label="Motivo declarado" value={termo.motivoDeclarado} />
                  <CampoLeitura label="Medidas compensatórias" value={termo.medidasCompensatorias} />
                  {r.prazoReavaliacao && <p className="text-sm">Prazo de reavaliação: {fmtDate(r.prazoReavaliacao)}</p>}
                </div>
              )}
            </>
          ) : (
            <AbaBloqueada motivo={r.envolveDadosPessoais && !dados3 ? 'Aguardando o Parecer do DPO.' : 'Disponível somente para o Titular, após a Etapa 2 (e o Parecer do DPO, quando exigido).'} />
          )}
        </TabsContent>

        {/* Etapa 5 — Ordem de Implementação */}
        <TabsContent value="etapa5" className="space-y-3 pt-3">
          {etapa5Editable ? (
            <form onSubmit={submitEtapa5} className="space-y-3">
              <div className="space-y-1.5"><Label>Data de execução planejada</Label><Input type="date" value={f5.dataExecucaoPlanejada} onChange={(e) => setF5((p) => ({ ...p, dataExecucaoPlanejada: e.target.value }))} /></div>
              {(
                [
                  ['escopoAprovado', 'Escopo aprovado *'],
                  ['equipamentosServicos', 'Equipamentos e serviços envolvidos'],
                  ['responsaveis', 'Responsáveis'],
                  ['planoRollback', 'Plano de rollback *'],
                  ['riscosMudanca', 'Riscos da mudança'],
                  ['backupAnterior', 'Backup anterior à alteração'],
                  ['criteriosSucesso', 'Critérios de sucesso *'],
                  ['testesObrigatorios', 'Testes obrigatórios'],
                  ['indisponibilidadePrevista', 'Indisponibilidade prevista'],
                  ['comunicacaoColaboradores', 'Comunicação aos colaboradores'],
                  ['autorizacaoAcessoPrivilegiado', 'Autorização de acesso privilegiado'],
                ] as Array<[keyof typeof f5, string]>
              ).map(([key, label]) => (
                <div className="space-y-1.5" key={key}>
                  <Label>{label}</Label>
                  <Textarea rows={2} value={String(f5[key])} onChange={(e) => setF5((p) => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex justify-end"><Button type="submit" disabled={isPending}>Emitir ordem de implementação</Button></div>
            </form>
          ) : dados5 ? (
            <>
              <CampoLeitura label="Escopo aprovado" value={dados5.escopoAprovado} />
              <CampoLeitura label="Equipamentos e serviços" value={dados5.equipamentosServicos} />
              <CampoLeitura label="Responsáveis" value={dados5.responsaveis} />
              <CampoLeitura label="Plano de rollback" value={dados5.planoRollback} />
              <CampoLeitura label="Riscos da mudança" value={dados5.riscosMudanca} />
              <CampoLeitura label="Backup anterior" value={dados5.backupAnterior} />
              <CampoLeitura label="Critérios de sucesso" value={dados5.criteriosSucesso} />
              <CampoLeitura label="Testes obrigatórios" value={dados5.testesObrigatorios} />
              <CampoLeitura label="Indisponibilidade prevista" value={dados5.indisponibilidadePrevista} />
              <CampoLeitura label="Comunicação aos colaboradores" value={dados5.comunicacaoColaboradores} />
              <CampoLeitura label="Autorização de acesso privilegiado" value={dados5.autorizacaoAcessoPrivilegiado} />
              <p className="text-xs text-muted-foreground">Emitida por {r.ordemEmitidaPor?.name ?? r.ordemEmitidaPor?.email} em {fmtDate(r.ordemEmitidaEm)}</p>
            </>
          ) : (
            <AbaBloqueada motivo="Disponível assim que a recomendação for aprovada pelo Controlador." />
          )}
        </TabsContent>

        {/* Etapa 6 — Execução */}
        <TabsContent value="etapa6" className="space-y-3 pt-3">
          {etapa6Editable ? (
            <form onSubmit={submitEtapa6} className="space-y-3">
              <div className="space-y-1.5"><Label>Data de execução realizada</Label><Input type="date" value={f6.dataExecucaoRealizada} onChange={(e) => setF6((p) => ({ ...p, dataExecucaoRealizada: e.target.value }))} /></div>
              {(
                [
                  ['relatorioTecnico', 'Relatório técnico de implementação *'],
                  ['configuracaoAnterior', 'Configuração anterior'],
                  ['configuracaoPosterior', 'Configuração posterior'],
                  ['usuariosExecutores', 'Usuários que executaram a mudança'],
                  ['resultadosTestes', 'Resultados dos testes'],
                  ['falhas', 'Falhas encontradas'],
                  ['medidasCorretivas', 'Medidas corretivas'],
                ] as Array<[keyof typeof f6, string]>
              ).map(([key, label]) => (
                <div className="space-y-1.5" key={key}>
                  <Label>{label}</Label>
                  <Textarea rows={2} value={String(f6[key])} onChange={(e) => setF6((p) => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex justify-end"><Button type="submit" disabled={isPending}>Registrar execução</Button></div>
            </form>
          ) : dados6 ? (
            <>
              <CampoLeitura label="Relatório técnico" value={dados6.relatorioTecnico} />
              <CampoLeitura label="Configuração anterior" value={dados6.configuracaoAnterior} />
              <CampoLeitura label="Configuração posterior" value={dados6.configuracaoPosterior} />
              <CampoLeitura label="Usuários executores" value={dados6.usuariosExecutores} />
              <CampoLeitura label="Resultados dos testes" value={dados6.resultadosTestes} />
              <CampoLeitura label="Falhas encontradas" value={dados6.falhas} />
              <CampoLeitura label="Medidas corretivas" value={dados6.medidasCorretivas} />
            </>
          ) : (
            <AbaBloqueada motivo="Disponível assim que a ordem de implementação for emitida." />
          )}
        </TabsContent>

        {/* Etapa 7 — Teste e Aceite */}
        <TabsContent value="etapa7" className="space-y-3 pt-3">
          {etapa7Editable ? (
            <form onSubmit={submitEtapa7} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Resultado *</Label>
                <Select value={f7.aceiteResultado} onValueChange={(v) => v && setF7((p) => ({ ...p, aceiteResultado: v as typeof p.aceiteResultado }))}>
                  <SelectTrigger><SelectValue>{selectLabel(RESULTADO_ACEITE_LABEL)}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(RESULTADO_ACEITE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                {f7.aceiteResultado === 'NAO_CONFORME' && (
                  <p className="text-xs text-amber-700">Um resultado não conforme devolve a recomendação para a Etapa 6 (retrabalho).</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Controlador que assina o aceite *</Label>
                <Select value={f7.aceiteControladorUserId} onValueChange={(v) => v && setF7((p) => ({ ...p, aceiteControladorUserId: v }))}>
                  <SelectTrigger><SelectValue>{(v: unknown) => titulares.find((m) => m.id === v)?.name ?? 'Selecione'}</SelectValue></SelectTrigger>
                  <SelectContent>{titulares.map((m) => <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(
                [
                  ['requisitoAtendido', 'Requisito atendido *'],
                  ['testesRealizados', 'Testes realizados *'],
                  ['resultadoObtido', 'Resultado obtido *'],
                  ['pendencias', 'Pendências'],
                  ['riscoResidual', 'Risco residual'],
                ] as Array<[keyof typeof f7, string]>
              ).map(([key, label]) => (
                <div className="space-y-1.5" key={key}>
                  <Label>{label}</Label>
                  <Textarea rows={2} value={String(f7[key])} onChange={(e) => setF7((p) => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex justify-end"><Button type="submit" disabled={isPending}>Registrar aceite</Button></div>
            </form>
          ) : dados7 ? (
            <>
              <Badge variant="outline">{RESULTADO_ACEITE_LABEL[r.aceiteResultado ?? '']}</Badge>
              <CampoLeitura label="Requisito atendido" value={dados7.requisitoAtendido} />
              <CampoLeitura label="Testes realizados" value={dados7.testesRealizados} />
              <CampoLeitura label="Resultado obtido" value={dados7.resultadoObtido} />
              <CampoLeitura label="Pendências" value={dados7.pendencias} />
              <CampoLeitura label="Risco residual" value={dados7.riscoResidual} />
              <p className="text-xs text-muted-foreground">
                Técnico: {r.aceiteTecnico?.name ?? r.aceiteTecnico?.email} · Controlador: {r.aceiteControlador?.name ?? r.aceiteControlador?.email} · {fmtDate(r.dataAceite)}
              </p>
            </>
          ) : (
            <AbaBloqueada motivo="Disponível assim que a execução for registrada." />
          )}
        </TabsContent>

        {/* Etapa 8 — Atualização dos documentos de governança */}
        <TabsContent value="etapa8" className="space-y-3 pt-3">
          {etapa8Editable ? (
            <form onSubmit={submitEtapa8} className="space-y-3">
              <p className="text-sm text-muted-foreground">Marque os documentos de governança atualizados em razão desta mudança.</p>
              <div className="grid grid-cols-2 gap-2">
                {DOC_CHECKLIST.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f8[key] as boolean} onChange={(e) => setF8((p) => ({ ...p, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="space-y-1.5"><Label>Outros</Label><Textarea rows={2} value={f8.outros} onChange={(e) => setF8((p) => ({ ...p, outros: e.target.value }))} /></div>
              <div className="flex justify-end"><Button type="submit" disabled={isPending}>Concluir recomendação</Button></div>
            </form>
          ) : dados8 ? (
            <>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {DOC_CHECKLIST.map(({ key, label }) => (
                  <p key={key}>{dados8[key as keyof Etapa8Data] ? '✓' : '—'} {label}</p>
                ))}
              </div>
              <CampoLeitura label="Outros" value={dados8.outros} />
              <p className="text-xs text-muted-foreground">Atualizado em {fmtDate(r.documentosAtualizadosEm)}</p>
            </>
          ) : (
            <AbaBloqueada motivo="Disponível assim que o teste e aceite forem concluídos com sucesso." />
          )}
        </TabsContent>
      </Tabs>

      <div className="pt-2 border-t">
        <EvidenciasUpload
          serventiaId={serventiaId}
          recomendacaoTecnicaId={r.id}
          evidencias={r.evidencias}
          podeEditar={!somenteLeitura}
          podeExcluir={['TITULAR', 'RESPONSAVEL_TECNICO'].includes(papelAtual)}
          retencaoAnos={retencaoAnos}
        />
      </div>
    </div>
  )
}
