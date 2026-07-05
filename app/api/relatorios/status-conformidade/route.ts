import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { calcularPrazos, parametrosPorClasse, proximoTesteRestauracaoDevido } from '@/lib/business-rules'
import { getProrrogacaoAtivaData } from '@/lib/prorrogacao'
import { gerarStatusConformidadePdf, type EtapaStatusItem } from '@/lib/pdf-status-conformidade'

export const runtime = 'nodejs'

/** GET /api/relatorios/status-conformidade — Relatório de Status de Conformidade (spec 5.8), para a Corregedoria */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Apenas Titular ou Responsável Técnico podem gerar este relatório' }, { status: 403 })
  }

  const serventia = membro.serventia
  const geradoEm = new Date()

  const etapas = await db.etapa.findMany({
    orderBy: { numero: 'asc' },
    include: {
      requisitos: {
        where: { classesAplicaveis: { has: serventia.classe } },
        include: { progressos: { where: { serventiaId: serventia.id } } },
      },
      declaracoes: { where: { serventiaId: serventia.id } },
    },
  })

  const [incidentes, vulnerabilidades, testes, totalEvidencias] = await Promise.all([
    db.incidente.findMany({ where: { serventiaId: serventia.id } }),
    db.vulnerabilidade.findMany({ where: { serventiaId: serventia.id } }),
    db.testeRestauracao.findMany({ where: { serventiaId: serventia.id }, orderBy: { dataTeste: 'desc' } }),
    db.evidencia.count({ where: { deletedAt: null, progressoRequisito: { serventiaId: serventia.id } } }),
  ])

  const prorrogacaoNovaData = await getProrrogacaoAtivaData(serventia.id)
  const prazos = calcularPrazos(
    serventia.dataVigenciaNorma,
    serventia.classe,
    !!prorrogacaoNovaData,
    prorrogacaoNovaData,
  )
  const params = parametrosPorClasse(serventia.classe)

  const etapasStatus: EtapaStatusItem[] = etapas.map((e) => ({
    numero: e.numero,
    titulo: e.titulo,
    totalRequisitos: e.requisitos.length,
    concluidos: e.requisitos.filter(
      (r) => r.progressos[0] && ['CONCLUIDO', 'NAO_APLICAVEL'].includes(r.progressos[0].status),
    ).length,
    declarada: e.declaracoes.length > 0,
    dataDeclaracao: e.declaracoes[0]?.dataDeclaracao ?? null,
  }))

  const hoje = new Date()
  const ultimoTeste = testes[0]
  const pdfBytes = await gerarStatusConformidadePdf({
    serventiaNome: serventia.nome,
    serventiaCns: serventia.cns,
    classe: serventia.classe,
    subclasse: serventia.subclasse,
    municipio: serventia.municipio,
    uf: serventia.uf,
    prazoEtapas12: prazos.etapas12,
    prazoConclusaoTotal: prazos.conclusaoTotal,
    etapas: etapasStatus,
    incidentesResumo: {
      total: incidentes.length,
      criticosAbertos: incidentes.filter((i) => i.gravidade === 'CRITICO' && i.status !== 'ENCERRADO').length,
      comunicadosCorregedoria: incidentes.filter((i) => i.comunicadoCorregedoria).length,
    },
    vulnerabilidadesResumo: {
      total: vulnerabilidades.length,
      vencidas: vulnerabilidades.filter((v) => !v.dataEncerramento && v.prazoLimite < hoje).length,
      encerradas: vulnerabilidades.filter((v) => v.dataEncerramento).length,
    },
    testesRestauracaoResumo: {
      total: testes.length,
      ultimaData: ultimoTeste?.dataTeste ?? null,
      ultimaConformidade: ultimoTeste?.conformidade ?? null,
      proximoDevido: proximoTesteRestauracaoDevido(ultimoTeste?.dataTeste ?? null, params.testeRestauracaoMeses),
    },
    totalEvidencias,
    geradoEm,
    geradoPor: session.user.name ?? session.user.email ?? '',
  })

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'RELATORIO_GERADO',
    entidade: 'Serventia',
    entidadeId: serventia.id,
    valorNovo: { tipo: 'STATUS_CONFORMIDADE' },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="status-conformidade-${geradoEm.toISOString().slice(0, 10)}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache',
    },
  })
}
