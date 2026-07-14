import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { gerarRelatorioSimplificadoPdf, type RequisitoSimplificadoItem } from '@/lib/pdf-relatorio-simplificado'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * GET /api/relatorios/simplificado?etapaId=... — Relatório Simplificado
 * (Anexo IV, item VII), forma de comprovação dispensada do dossiê técnico
 * ampliado, aplicável especialmente à Classe 1 (Art. 5º, §6º).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Apenas Titular ou Responsável Técnico podem gerar este relatório' }, { status: 403 })
  }

  const serventia = membro.serventia
  if (serventia.classe !== 'CLASSE_1') {
    return NextResponse.json(
      { error: 'O Relatório Simplificado aplica-se apenas a serventias da Classe 1 (Art. 5º, §6º).' },
      { status: 400 },
    )
  }

  const etapaId = req.nextUrl.searchParams.get('etapaId')
  if (!etapaId) return NextResponse.json({ error: 'Parâmetro etapaId é obrigatório' }, { status: 400 })

  try {
    const etapa = await db.etapa.findUnique({ where: { id: etapaId } })
    if (!etapa) return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })

    const requisitos = await db.requisito.findMany({
      where: { etapaId, classesAplicaveis: { has: 'CLASSE_1' } },
      orderBy: { codigo: 'asc' },
      include: {
        progressos: {
          where: { serventiaId: serventia.id },
          include: { evidencias: { where: { deletedAt: null } } },
        },
      },
    })

    const geradoEm = new Date()
    const itens: RequisitoSimplificadoItem[] = requisitos.map((r) => {
      const progresso = r.progressos[0]
      return {
        codigo: r.codigo,
        titulo: r.titulo,
        descricaoNorma: r.descricaoNorma,
        solucaoAdotada: progresso?.solucaoAdotada ?? null,
        demonstracaoEquivalencia: progresso?.demonstracaoEquivalencia ?? null,
        evidenciasNomes: progresso?.evidencias.map((e) => e.nomeArquivo) ?? [],
        status: progresso?.status ?? 'NAO_INICIADO',
      }
    })

    const pdfBytes = await gerarRelatorioSimplificadoPdf({
      serventiaNome: serventia.nome,
      serventiaCns: serventia.cns,
      classe: serventia.classe,
      etapaNumero: etapa.numero,
      etapaTitulo: etapa.titulo,
      requisitos: itens,
      geradoEm,
      responsavelNome: serventia.responsavelTecnico ?? session.user.name ?? session.user.email ?? '',
    })

    await logAudit({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      acao: 'RELATORIO_GERADO',
      entidade: 'Etapa',
      entidadeId: etapa.id,
      valorNovo: { tipo: 'RELATORIO_SIMPLIFICADO', etapaNumero: etapa.numero },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    })

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio-simplificado-etapa${etapa.numero}-${geradoEm.toISOString().slice(0, 10)}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'gerar_relatorio_simplificado' })
    log.error({ err, etapaId }, 'Falha inesperada ao gerar relatório simplificado')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
