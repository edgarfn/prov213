import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { calcularPrazos, calcularSemaforo, parametrosPorClasse } from '@/lib/business-rules'
import { getAlertasServentia, type Alerta, type AlertaTipo } from '@/lib/alertas'
import { getProrrogacaoAtivaData } from '@/lib/prorrogacao'
import { montarTimelineEtapas } from '@/lib/timeline'
import { DashboardCharts } from '@/components/dashboard-charts'
import { EtapasTimeline } from '@/components/etapas-timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Requisito, ProgressoRequisito, ClasseServentia } from '@/types/prisma'
import { differenceInDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, CalendarDays, Plus, ShieldAlert, Bug, HardDriveDownload, CalendarClock, FileClock } from 'lucide-react'

const ALERTA_ICONE: Record<AlertaTipo, React.ElementType> = {
  ETAPA_PRAZO: CalendarClock,
  CONCLUSAO_PRAZO: CalendarClock,
  INCIDENTE_CRITICO: ShieldAlert,
  VULNERABILIDADE_PRAZO: Bug,
  TESTE_RESTAURACAO_ATRASADO: HardDriveDownload,
  PRORROGACAO_PROXIMA_LIMITE: FileClock,
}

const ALERTA_COR: Record<Alerta['severidade'], string> = {
  vermelho: 'border-red-100 bg-red-50 hover:bg-red-100 text-red-600',
  amarelo: 'border-amber-100 bg-amber-50 hover:bg-amber-100 text-amber-600',
  verde: 'border-green-100 bg-green-50 hover:bg-green-100 text-green-600',
}

type ReqComProgresso = Requisito & { progressos: ProgressoRequisito[] }

function countConcluidos(requisitos: ReqComProgresso[]): number {
  return requisitos.filter(
    (r) => r.progressos[0] && ['CONCLUIDO', 'NAO_APLICAVEL'].includes(r.progressos[0].status),
  ).length
}

function countEmAndamento(requisitos: ReqComProgresso[]): number {
  return requisitos.filter((r) => r.progressos[0]?.status === 'EM_ANDAMENTO').length
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const serventia = membro.serventia
  const hoje = new Date()

  const etapas = await db.etapa.findMany({
    orderBy: { numero: 'asc' },
    include: {
      requisitos: {
        where: { classesAplicaveis: { has: serventia.classe as ClasseServentia } },
        include: {
          progressos: { where: { serventiaId: serventia.id } },
        },
      },
      declaracoes: { where: { serventiaId: serventia.id } },
    },
  })

  const prorrogacaoNovaData = await getProrrogacaoAtivaData(serventia.id)
  const prazos = calcularPrazos(
    serventia.dataVigenciaNorma,
    serventia.classe as ClasseServentia,
    !!prorrogacaoNovaData,
    prorrogacaoNovaData,
  )

  const params = parametrosPorClasse(serventia.classe as ClasseServentia)

  // Central de Alertas — fonte única (lib/alertas.ts), também usada pelo badge da sidebar
  const { alertas, total: totalAlertas } = await getAlertasServentia(serventia.id, hoje)

  const allRequisitos = etapas.flatMap((e) => e.requisitos as ReqComProgresso[])
  const totalRequisitos = allRequisitos.length
  const concluidos = countConcluidos(allRequisitos)
  const emAndamento = countEmAndamento(allRequisitos)
  const percentualGeral = totalRequisitos > 0 ? Math.round((concluidos / totalRequisitos) * 100) : 0

  const diasParaEtapas12 = differenceInDays(prazos.etapas12, hoje)
  const diasParaConclusao = differenceInDays(prazos.conclusaoTotal, hoje)
  const semaforoEtapas12 = calcularSemaforo(prazos.etapas12, hoje)
  const semaforoConclusao = calcularSemaforo(prazos.conclusaoTotal, hoje)

  const semaforoCor: Record<string, string> = {
    verde: 'text-green-600 bg-green-50 border-green-200',
    amarelo: 'text-amber-600 bg-amber-50 border-amber-200',
    vermelho: 'text-red-600 bg-red-50 border-red-200',
  }

  const etapasChartData = etapas.map((e) => {
    const reqs = e.requisitos as ReqComProgresso[]
    const total = reqs.length
    const conc = countConcluidos(reqs)
    return {
      nome: `E${e.numero}`,
      titulo: e.titulo,
      concluidos: conc,
      pendentes: total - conc,
      percentual: total > 0 ? Math.round((conc / total) * 100) : 0,
    }
  })

  const statusChartData = [
    { name: 'Concluídos', value: concluidos, color: '#22c55e' },
    { name: 'Em Andamento', value: emAndamento, color: '#f59e0b' },
    { name: 'Não Iniciados', value: totalRequisitos - concluidos - emAndamento, color: '#e2e8f0' },
  ]

  const timelineEtapas = montarTimelineEtapas({
    hoje,
    dataVigencia: serventia.dataVigenciaNorma,
    prazoEtapas12: prazos.etapas12,
    prazoConclusaoTotal: prazos.conclusaoTotal,
    etapas: etapas.map((e) => {
      const reqs = e.requisitos as ReqComProgresso[]
      const total = reqs.length
      const conc = countConcluidos(reqs)
      return {
        numero: e.numero,
        titulo: e.titulo,
        dataDeclaracao: e.declaracoes[0]?.dataDeclaracao ?? null,
        percentualConcluido: total > 0 ? Math.round((conc / total) * 100) : 0,
      }
    }),
  })

  const classeLabel: Record<string, string> = {
    CLASSE_1: 'Classe 1',
    CLASSE_2: 'Classe 2',
    CLASSE_3: 'Classe 3',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{serventia.nome}</h1>
          <p className="text-muted-foreground">
            {classeLabel[serventia.classe]} · {serventia.municipio}/{serventia.uf}
          </p>
        </div>
        <Link href="/checklists">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ver Checklists
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progresso Geral</p>
                <p className="text-3xl font-bold mt-1">{percentualGeral}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {concluidos} de {totalRequisitos} requisitos
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-3xl font-bold mt-1">{emAndamento}</p>
                <p className="text-xs text-muted-foreground mt-1">requisitos em progresso</p>
              </div>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${semaforoCor[semaforoEtapas12]}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">Prazo Etapas 1+2</p>
                <p className="text-2xl font-bold mt-1">
                  {diasParaEtapas12 < 0 ? 'Vencido' : `${diasParaEtapas12}d`}
                </p>
                <p className="text-xs mt-1">
                  {format(prazos.etapas12, 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <CalendarDays className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${semaforoCor[semaforoConclusao]}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">Conclusão Total</p>
                <p className="text-2xl font-bold mt-1">
                  {diasParaConclusao < 0 ? 'Vencido' : `${diasParaConclusao}d`}
                </p>
                <p className="text-xs mt-1">
                  {format(prazos.conclusaoTotal, 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {totalAlertas > 0 && (
        <Card className={alertas.some((a) => a.severidade === 'vermelho') ? 'border-red-200' : 'border-amber-200'}>
          <CardHeader>
            <CardTitle
              className={`text-base flex items-center gap-2 ${
                alertas.some((a) => a.severidade === 'vermelho') ? 'text-red-700' : 'text-amber-700'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Painel de Alertas ({totalAlertas})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((alerta) => {
              const Icone = ALERTA_ICONE[alerta.tipo]
              return (
                <Link
                  key={alerta.id}
                  href={alerta.href}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${ALERTA_COR[alerta.severidade]}`}
                >
                  <Icone className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-slate-900">{alerta.titulo}</p>
                    <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      <EtapasTimeline etapas={timelineEtapas} hoje={hoje} />

      <DashboardCharts etapasData={etapasChartData} statusData={statusChartData} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas do Anexo IV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {etapas.map((etapa) => {
            const reqs = etapa.requisitos as ReqComProgresso[]
            const total = reqs.length
            const conc = countConcluidos(reqs)
            const pct = total > 0 ? Math.round((conc / total) * 100) : 0
            const declarada = etapa.declaracoes.length > 0

            return (
              <div key={etapa.id} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {declarada ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    etapa.numero
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{etapa.titulo}</p>
                    <span className="text-sm text-muted-foreground ml-2 flex-shrink-0">
                      {conc}/{total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-200'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium w-10 text-right">{pct}%</span>
                  {declarada && (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                      Declarada
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros Técnicos da {classeLabel[serventia.classe]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'RPO (máximo de perda de dados)', value: `${params.rpoHoras}h` },
              { label: 'RTO (tempo máximo para recuperar)', value: `${params.rtoHoras}h` },
              { label: 'Backup completo a cada', value: `${params.backupCompletoHoras}h` },
              { label: 'Internet mínima', value: `${params.internetMbps} Mbps` },
              { label: 'Teste de restauração', value: params.testeRestauracaoMeses === 6 ? 'Semestral' : 'Anual' },
              { label: 'Pentest', value: params.pentest ? 'A cada 2 anos' : 'Não exigido' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-muted-foreground">{label}</p>
                <p className="font-semibold mt-1">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
